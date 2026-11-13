"""
Blueprint de mangás.
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from decorators import permission_required
from parametros import ler_paginacao
from repositories import MangaRepository
from schemas import MangaSchema, ValidationError

mangas_bp = Blueprint('mangas', __name__)

manga_repository = MangaRepository()
manga_schema = MangaSchema()


@mangas_bp.route('', methods=['GET'])
def listar_mangas():
    """Listar mangás com filtros."""
    pagina, por_pagina = ler_paginacao()
    filtros = {
        'busca': request.args.get('busca'),
        'genero': request.args.get('genero'),
        'status': request.args.get('status'),
        'autor': request.args.get('autor'),
        'demografia': request.args.get('demografia'),
        'ordem': request.args.get('ordem', 'nota_media'),
    }
    mangas = manga_repository.buscar_por_tipo('manga', pagina=pagina, limite=por_pagina, filtros=filtros)
    return jsonify({'mangas': mangas, 'midias': mangas, 'pagina': pagina, 'por_pagina': por_pagina}), 200


@mangas_bp.route('/<string:manga_id>', methods=['GET'])
def detalhes_manga(manga_id):
    """Detalhes do mangá."""
    manga = manga_repository.buscar_manga_completo(manga_id)
    if not manga:
        return jsonify({'erro': 'Mangá não encontrado'}), 404
    return jsonify(manga), 200


@mangas_bp.route('/autor/<string:autor>', methods=['GET'])
def mangas_por_autor(autor):
    """Buscar mangás por autor."""
    return jsonify({'mangas': manga_repository.buscar_por_autor(autor)}), 200


@mangas_bp.route('/demografia/<string:demografia>', methods=['GET'])
def mangas_por_demografia(demografia):
    """Buscar mangás por demografia."""
    return jsonify({'mangas': manga_repository.buscar_por_demografia(demografia)}), 200


@mangas_bp.route('', methods=['POST'])
@jwt_required()
@permission_required('criar')
def criar_manga():
    """Criar mangá."""
    try:
        payload = manga_schema.load(request.get_json(silent=True) or {})
    except ValidationError as exc:
        return jsonify({'erro': 'Payload inválido', 'detalhes': exc.errors}), 400

    manga_id = manga_repository.inserir_manga({}, payload)
    return jsonify({'mensagem': 'Mangá criado com sucesso!', 'id_midia': manga_id}), 201
