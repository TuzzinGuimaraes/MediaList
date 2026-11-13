"""
Blueprint de mídias.
"""
from __future__ import annotations

import json
import logging

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from banco import consultar, transacao
from decorators import permission_required
from parametros import POR_PAGINA_MAX, ler_int, ler_paginacao
from repositories import MidiaRepository
from schemas import AnimeSchema, JogoSchema, MangaSchema, ValidationError

logger = logging.getLogger(__name__)

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


def _load_schema(tipo: str, data: dict, partial: bool = False) -> dict:
    schema = SCHEMA_BY_TYPE.get(tipo)
    if not schema:
        raise ValidationError({'tipo': 'Tipo de mídia inválido'})
    return schema.load(data, partial=partial)


def _carregar_atualizacoes(id_midia: str) -> list[dict]:
    """As 10 Atualizações de mídia mais recentes."""
    return consultar(
        """
        SELECT a.id_midia, t.nome_tipo AS tipo_midia, a.tipo_atualizacao, a.titulo,
               a.descricao, a.dados_adicionais, a.data_atualizacao
        FROM atualizacoes_midia a
        JOIN midias m ON m.id_midia = a.id_midia
        JOIN tipo_midia t ON t.id_tipo = m.id_tipo
        WHERE a.id_midia = %s
        ORDER BY a.data_atualizacao DESC, a.id_atualizacao DESC
        LIMIT 10
        """,
        (id_midia,),
    )


def _criar_atualizacao_midia(id_midia: str):
    """Grava a Atualização de mídia e, na mesma transação, a Notificação de cada
    Usuário que tem a Mídia na Lista pessoal num status ativo ou como favorita."""
    midia = midia_repository.buscar_por_id(id_midia)
    if not midia:
        return jsonify({'erro': 'Mídia não encontrada'}), 404

    data = request.get_json(silent=True) or {}
    if not data.get('tipo') or not data.get('titulo'):
        return jsonify({'erro': 'Tipo e título são obrigatórios'}), 400

    dados_adicionais = data.get('dados_adicionais') or {}
    if not isinstance(dados_adicionais, dict):
        return jsonify({'erro': 'dados_adicionais deve ser um objeto'}), 400

    statuses = sorted(NOTIFY_STATUSES.get(midia['tipo'], {'planejado'}))
    with transacao() as t:
        atualizacao = t.consultar_um(
            """
            INSERT INTO atualizacoes_midia (id_midia, tipo_atualizacao, titulo, descricao, dados_adicionais)
            VALUES (%s, %s, %s, %s, %s::jsonb)
            RETURNING id_atualizacao
            """,
            (id_midia, data['tipo'], data['titulo'], data.get('descricao'), json.dumps(dados_adicionais)),
        )
        enviadas = t.executar(
            """
            INSERT INTO notificacoes (id_usuario, id_atualizacao)
            SELECT id_usuario, %s
            FROM lista_usuarios
            WHERE id_midia = %s AND (status_consumo = ANY(%s) OR favorito)
            """,
            (atualizacao['id_atualizacao'], id_midia, statuses),
        )

    return jsonify({'mensagem': 'Atualização adicionada!', 'notificacoes_enviadas': enviadas}), 201


@midias_bp.route('', methods=['GET'])
def listar_midias():
    """Listar mídias com filtros por tipo."""
    tipo = request.args.get('tipo')
    pagina, por_pagina = ler_paginacao()
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


@midias_bp.route('/<string:id_midia>', methods=['GET'])
def detalhes_midia(id_midia):
    """Detalhes completos de qualquer mídia."""
    midia = midia_repository.buscar_por_id(id_midia)
    if not midia:
        return jsonify({'erro': 'Mídia não encontrada'}), 404

    midia['atualizacoes'] = _carregar_atualizacoes(id_midia)
    return jsonify(midia), 200


@midias_bp.route('/<string:id_midia>', methods=['PUT'])
@jwt_required()
@permission_required('editar')
def atualizar_midia(id_midia):
    """Atualizar qualquer mídia pelo id central."""
    existente = midia_repository.buscar_por_id(id_midia)
    if not existente:
        return jsonify({'erro': 'Mídia não encontrada'}), 404

    try:
        payload = _load_schema(existente['tipo'], request.get_json(silent=True) or {}, partial=True)
    except ValidationError as exc:
        return _payload_error(exc)

    if not midia_repository.atualizar_midia_base(id_midia, payload):
        return jsonify({'erro': 'Mídia não encontrada'}), 404
    return jsonify({'mensagem': 'Mídia atualizada com sucesso'}), 200


@midias_bp.route('/<string:id_midia>', methods=['DELETE'])
@jwt_required()
@permission_required('deletar')
def deletar_midia(id_midia):
    """Deletar mídia central."""
    if not midia_repository.deletar_midia(id_midia):
        return jsonify({'erro': 'Mídia não encontrada'}), 404
    return jsonify({'mensagem': 'Mídia removida com sucesso'}), 200


@midias_bp.route('/<string:id_midia>/atualizacoes', methods=['POST'])
@jwt_required()
@permission_required('criar')
def criar_atualizacao_midia(id_midia):
    """Criar atualização/notificação de mídia."""
    return _criar_atualizacao_midia(id_midia)


@midias_bp.route('/<string:id_midia>/distribuicao', methods=['GET'])
def distribuicao_midia(id_midia):
    """Distribuição de status dos usuários para uma mídia."""
    rows = consultar(
        """
        SELECT status_consumo, count(*) AS total
        FROM lista_usuarios
        WHERE id_midia = %s
        GROUP BY status_consumo
        ORDER BY total DESC, status_consumo
        """,
        (id_midia,),
    )
    return jsonify({'distribuicao': rows}), 200


@midias_bp.route('/trending', methods=['GET'])
def trending_midias():
    """Mídias mais bem avaliadas de um tipo."""
    tipo = request.args.get('tipo', 'anime')
    limite = ler_int('limite', 10, minimo=1, maximo=POR_PAGINA_MAX)
    midias = midia_repository.buscar_por_tipo(tipo, pagina=1, limite=limite, filtros={'ordem': 'nota_media'})
    return jsonify({'midias': midias}), 200
