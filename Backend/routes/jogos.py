"""
Blueprint de jogos.
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from decorators import permission_required
from parametros import ler_paginacao
from repositories import JogoRepository
from schemas import JogoSchema, ValidationError

jogos_bp = Blueprint('jogos', __name__)

jogo_repository = JogoRepository()
jogo_schema = JogoSchema()


@jogos_bp.route('', methods=['GET'])
def listar_jogos():
    """Listar jogos com filtros."""
    pagina, por_pagina = ler_paginacao()
    filtros = {
        'busca': request.args.get('busca'),
        'genero': request.args.get('genero'),
        'status': request.args.get('status'),
        'plataforma': request.args.get('plataforma'),
        'desenvolvedor': request.args.get('desenvolvedor'),
        'modo_jogo': request.args.get('modo_jogo'),
        'ordem': request.args.get('ordem', 'nota_media'),
    }
    jogos = jogo_repository.buscar_por_tipo('jogo', pagina=pagina, limite=por_pagina, filtros=filtros)
    return jsonify({'jogos': jogos, 'midias': jogos, 'pagina': pagina, 'por_pagina': por_pagina}), 200


@jogos_bp.route('/<string:jogo_id>', methods=['GET'])
def detalhes_jogo(jogo_id):
    """Detalhes do jogo."""
    jogo = jogo_repository.buscar_jogo_completo(jogo_id)
    if not jogo:
        return jsonify({'erro': 'Jogo não encontrado'}), 404
    return jsonify(jogo), 200


@jogos_bp.route('/plataforma/<string:plataforma>', methods=['GET'])
def jogos_por_plataforma(plataforma):
    """Buscar jogos por plataforma."""
    return jsonify({'jogos': jogo_repository.buscar_por_plataforma(plataforma)}), 200


@jogos_bp.route('', methods=['POST'])
@jwt_required()
@permission_required('criar')
def criar_jogo():
    """Criar jogo."""
    try:
        payload = jogo_schema.load(request.get_json(silent=True) or {})
    except ValidationError as exc:
        return jsonify({'erro': 'Payload inválido', 'detalhes': exc.errors}), 400

    jogo_id = jogo_repository.inserir_jogo({}, payload)
    return jsonify({'mensagem': 'Jogo criado com sucesso!', 'id_midia': jogo_id}), 201
