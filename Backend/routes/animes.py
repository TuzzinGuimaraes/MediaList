"""
Blueprint de animes.
Mantém compatibilidade com clientes legados.
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from decorators import get_user_permissions, permission_required
from repositories import AnimeRepository
from schemas import AnimeSchema, ValidationError

from .midias import _carregar_atualizacoes, _criar_atualizacao_midia

animes_bp = Blueprint('animes', __name__)

anime_repository = AnimeRepository()
anime_schema = AnimeSchema()


@animes_bp.route('', methods=['GET'])
def listar_animes():
    """Listar animes com filtros."""
    try:
        pagina = int(request.args.get('pagina', 1))
        por_pagina = int(request.args.get('por_pagina', 20))
        filtros = {
            'busca': request.args.get('busca'),
            'genero': request.args.get('genero'),
            'status': request.args.get('status'),
            'estudio': request.args.get('estudio'),
            'ordem': request.args.get('ordem', 'nota_media'),
        }
        animes = anime_repository.buscar_por_tipo('anime', pagina=pagina, limite=por_pagina, filtros=filtros)
        return jsonify({
            'animes': animes,
            'midias': animes,
            'pagina': pagina,
            'por_pagina': por_pagina,
        }), 200
    except Exception as exc:
        print(f"Erro ao listar animes: {exc}")
        return jsonify({'erro': 'Erro ao buscar animes'}), 500


@animes_bp.route('/<string:anime_id>', methods=['GET'])
def detalhes_anime(anime_id):
    """Obter detalhes completos do anime."""
    try:
        anime = anime_repository.buscar_anime_completo(anime_id)
        if not anime:
            return jsonify({'erro': 'Anime não encontrado'}), 404

        anime['atualizacoes'] = _carregar_atualizacoes(anime_id)
        return jsonify(anime), 200
    except Exception as exc:
        print(f"Erro ao buscar detalhes do anime: {exc}")
        return jsonify({'erro': 'Erro ao buscar detalhes do anime'}), 500


@animes_bp.route('', methods=['POST'])
@jwt_required()
@permission_required('criar')
def criar_anime():
    """Criar novo anime."""
    try:
        payload = anime_schema.load(request.get_json() or {})
    except ValidationError as exc:
        return jsonify({'erro': 'Payload inválido', 'detalhes': exc.errors}), 400

    try:
        user_id = get_jwt_identity()
        permissions = get_user_permissions(user_id)
        anime_id = anime_repository.inserir_anime({}, payload)
        anime = anime_repository.buscar_anime_completo(anime_id)

        return jsonify({
            'mensagem': 'Anime criado com sucesso!',
            'id_midia': anime_id,
            'id_anime': anime_id,
            'codigo_midia': anime.get('codigo_midia') if anime else None,
            'codigo_anime': anime.get('codigo_midia') if anime else None,
            'criado_por': permissions['nivel_acesso'],
        }), 201
    except Exception as exc:
        print(f"Erro ao criar anime: {exc}")
        return jsonify({'erro': 'Erro ao criar anime'}), 500


@animes_bp.route('/<string:anime_id>', methods=['PUT'])
@jwt_required()
@permission_required('editar')
def editar_anime(anime_id):
    """Editar anime."""
    try:
        payload = anime_schema.load(request.get_json() or {}, partial=True)
    except ValidationError as exc:
        return jsonify({'erro': 'Payload inválido', 'detalhes': exc.errors}), 400

    try:
        if not anime_repository.atualizar_anime(anime_id, payload):
            return jsonify({'erro': 'Anime não encontrado'}), 404
        return jsonify({'mensagem': 'Anime atualizado com sucesso'}), 200
    except Exception as exc:
        print(f"Erro ao editar anime: {exc}")
        return jsonify({'erro': 'Erro ao editar anime'}), 500


@animes_bp.route('/<string:anime_id>', methods=['DELETE'])
@jwt_required()
@permission_required('deletar')
def deletar_anime(anime_id):
    """Deletar anime."""
    try:
        if not anime_repository.deletar_midia(anime_id):
            return jsonify({'erro': 'Anime não encontrado'}), 404
        return jsonify({'mensagem': 'Anime removido com sucesso'}), 200
    except Exception as exc:
        print(f"Erro ao deletar anime: {exc}")
        return jsonify({'erro': 'Erro ao deletar anime'}), 500


@animes_bp.route('/<string:anime_id>/atualizacoes', methods=['POST'])
@jwt_required()
@permission_required('criar')
def adicionar_atualizacao_anime(anime_id):
    """Adicionar atualização para anime da lista."""
    return _criar_atualizacao_midia(anime_id)
