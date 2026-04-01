"""
Blueprint de mídias.
"""
from __future__ import annotations

from datetime import datetime

import database
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from decorators import permission_required
from repositories import MidiaRepository
from schemas import AnimeSchema, JogoSchema, MangaSchema, ValidationError

midias_bp = Blueprint('midias', __name__)

midia_repository = MidiaRepository()

SCHEMA_BY_TYPE = {
    'anime': AnimeSchema(),
    'manga': MangaSchema(),
    'jogo': JogoSchema(),
}

NOTIFY_STATUSES = {
    'anime': {'assistindo', 'planejado'},
    'manga': {'lendo', 'planejado'},
    'jogo': {'jogando', 'na_fila', 'planejado'},
}


def _payload_error(exc: ValidationError):
    return jsonify({'erro': 'Payload inválido', 'detalhes': exc.errors}), 400


def _media_title(midia: dict) -> str:
    return midia.get('titulo_portugues') or midia.get('titulo_original') or 'Mídia'


def _load_schema(tipo: str, data: dict, partial: bool = False) -> dict:
    schema = SCHEMA_BY_TYPE.get(tipo)
    if not schema:
        raise ValidationError({'tipo': 'Tipo de mídia inválido'})
    return schema.load(data, partial=partial)


def _carregar_atualizacoes(id_midia: str) -> list[dict]:
    if database.mongo_db is None or database.atualizacoes_collection is None:
        return []

    try:
        return list(
            database.atualizacoes_collection.find(
                {'id_midia': id_midia},
                {'_id': 0},
            ).sort('data_atualizacao', -1).limit(10)
        )
    except Exception:
        return []


def _criar_atualizacao_midia(id_midia: str):
    if database.mongo_db is None or database.atualizacoes_collection is None or database.notificacoes_collection is None:
        return jsonify({'erro': 'MongoDB não disponível'}), 503

    midia = midia_repository.buscar_por_id(id_midia)
    if not midia:
        return jsonify({'erro': 'Mídia não encontrada'}), 404

    try:
        data = request.get_json() or {}
        if not data.get('tipo') or not data.get('titulo'):
            return jsonify({'erro': 'Tipo e título são obrigatórios'}), 400

        atualizacao = {
            'id_midia': id_midia,
            'tipo_midia': midia['tipo'],
            'tipo_atualizacao': data['tipo'],
            'titulo': data['titulo'],
            'descricao': data.get('descricao'),
            'data_atualizacao': datetime.now(),
            'dados_adicionais': data.get('dados_adicionais', {}),
        }
        database.atualizacoes_collection.insert_one(atualizacao)

        statuses = sorted(NOTIFY_STATUSES.get(midia['tipo'], {'planejado'}))
        placeholders = ', '.join(['%s'] * len(statuses))
        usuarios = database.execute_query(
            f"""
            SELECT DISTINCT id_usuario
            FROM lista_usuarios
            WHERE id_midia = %s
              AND (status_consumo IN ({placeholders}) OR favorito = TRUE)
            """,
            (id_midia, *statuses),
        )
        if usuarios is None:
            usuarios = []

        titulo_midia = _media_title(midia)
        notificacoes = [
            {
                'id_usuario': user['id_usuario'],
                'id_midia': id_midia,
                'tipo_midia': midia['tipo'],
                'tipo': data['tipo'],
                'titulo': data['titulo'],
                'midia_nome': titulo_midia,
                'anime_nome': titulo_midia,
                'mensagem': f"Novidade em {midia['tipo']} da sua lista: {titulo_midia}",
                'lida': False,
                'data_criacao': datetime.now(),
            }
            for user in usuarios or []
        ]

        if notificacoes:
            database.notificacoes_collection.insert_many(notificacoes)

        return jsonify({
            'mensagem': 'Atualização adicionada!',
            'notificacoes_enviadas': len(notificacoes),
        }), 201
    except Exception as exc:
        print(f"Erro ao adicionar atualização: {exc}")
        return jsonify({'erro': 'Erro ao adicionar atualização'}), 500


@midias_bp.route('', methods=['GET'])
def listar_midias():
    """Listar mídias com filtros por tipo."""
    try:
        tipo = request.args.get('tipo')
        pagina = int(request.args.get('pagina', 1))
        por_pagina = int(request.args.get('por_pagina', 20))
        filtros = {
            'busca': request.args.get('busca'),
            'genero': request.args.get('genero'),
            'status': request.args.get('status'),
            'autor': request.args.get('autor'),
            'estudio': request.args.get('estudio'),
            'demografia': request.args.get('demografia'),
            'plataforma': request.args.get('plataforma'),
            'desenvolvedor': request.args.get('desenvolvedor'),
            'modo_jogo': request.args.get('modo_jogo'),
            'artista': request.args.get('artista'),
            'ordem': request.args.get('ordem', 'nota_media'),
        }

        midias = midia_repository.buscar_por_tipo(tipo, pagina=pagina, limite=por_pagina, filtros=filtros)
        return jsonify({
            'midias': midias,
            'tipo': tipo,
            'pagina': pagina,
            'por_pagina': por_pagina,
        }), 200
    except Exception as exc:
        print(f"Erro ao listar mídias: {exc}")
        return jsonify({'erro': 'Erro ao buscar mídias'}), 500


@midias_bp.route('/<string:id_midia>', methods=['GET'])
def detalhes_midia(id_midia):
    """Detalhes completos de qualquer mídia."""
    try:
        midia = midia_repository.buscar_por_id(id_midia)
        if not midia:
            return jsonify({'erro': 'Mídia não encontrada'}), 404

        midia['atualizacoes'] = _carregar_atualizacoes(id_midia)
        return jsonify(midia), 200
    except Exception as exc:
        print(f"Erro ao buscar mídia: {exc}")
        return jsonify({'erro': 'Erro ao buscar detalhes da mídia'}), 500


@midias_bp.route('/<string:id_midia>', methods=['PUT'])
@jwt_required()
@permission_required('editar')
def atualizar_midia(id_midia):
    """Atualizar qualquer mídia pelo id central."""
    existente = midia_repository.buscar_por_id(id_midia)
    if not existente:
        return jsonify({'erro': 'Mídia não encontrada'}), 404

    try:
        payload = _load_schema(existente['tipo'], request.get_json() or {}, partial=True)
    except ValidationError as exc:
        return _payload_error(exc)

    try:
        atualizado = midia_repository.atualizar_midia_base(id_midia, payload)
        if not atualizado:
            return jsonify({'erro': 'Nenhum campo para atualizar'}), 400
        return jsonify({'mensagem': 'Mídia atualizada com sucesso'}), 200
    except Exception as exc:
        print(f"Erro ao atualizar mídia: {exc}")
        return jsonify({'erro': 'Erro ao atualizar mídia'}), 500


@midias_bp.route('/<string:id_midia>', methods=['DELETE'])
@jwt_required()
@permission_required('deletar')
def deletar_midia(id_midia):
    """Deletar mídia central."""
    try:
        if not midia_repository.deletar_midia(id_midia):
            return jsonify({'erro': 'Mídia não encontrada'}), 404
        return jsonify({'mensagem': 'Mídia removida com sucesso'}), 200
    except Exception as exc:
        print(f"Erro ao deletar mídia: {exc}")
        return jsonify({'erro': 'Erro ao deletar mídia'}), 500


@midias_bp.route('/<string:id_midia>/atualizacoes', methods=['POST'])
@jwt_required()
@permission_required('criar')
def criar_atualizacao_midia(id_midia):
    """Criar atualização/notificação de mídia."""
    return _criar_atualizacao_midia(id_midia)


@midias_bp.route('/<string:id_midia>/distribuicao', methods=['GET'])
def distribuicao_midia(id_midia):
    """Distribuição de status dos usuários para uma mídia."""
    try:
        conn = database.get_db_connection()
        if not conn:
            return jsonify({'distribuicao': []}), 200
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT status_consumo, COUNT(*) AS total
            FROM lista_usuarios
            WHERE id_midia = %s
            GROUP BY status_consumo
            ORDER BY total DESC
            """,
            (id_midia,),
        )
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify({'distribuicao': rows}), 200
    except Exception as exc:
        print(f"Erro ao buscar distribuição: {exc}")
        return jsonify({'erro': 'Erro ao buscar distribuição'}), 500


@midias_bp.route('/trending', methods=['GET'])
def trending_midias():
    """Mídias mais bem avaliadas de um tipo."""
    try:
        tipo = request.args.get('tipo', 'anime')
        limite = min(int(request.args.get('limite', 10)), 50)
        midias = midia_repository.buscar_por_tipo(tipo, pagina=1, limite=limite, filtros={'ordem': 'nota_media'})
        return jsonify({'midias': midias}), 200
    except Exception as exc:
        print(f"Erro ao buscar trending: {exc}")
        return jsonify({'erro': 'Erro ao buscar trending'}), 500
