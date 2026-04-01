"""
Blueprint de jogos.
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from decorators import permission_required
from repositories import JogoRepository
from schemas import JogoSchema, ValidationError

jogos_bp = Blueprint('jogos', __name__)

jogo_repository = JogoRepository()
jogo_schema = JogoSchema()


@jogos_bp.route('', methods=['GET'])
def listar_jogos():
    """Listar jogos com filtros."""
    try:
        pagina = int(request.args.get('pagina', 1))
        por_pagina = int(request.args.get('por_pagina', 20))
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
    except Exception as exc:
        print(f"Erro ao listar jogos: {exc}")
        return jsonify({'erro': 'Erro ao buscar jogos'}), 500


@jogos_bp.route('/<string:jogo_id>', methods=['GET'])
def detalhes_jogo(jogo_id):
    """Detalhes do jogo."""
    try:
        jogo = jogo_repository.buscar_jogo_completo(jogo_id)
        if not jogo:
            return jsonify({'erro': 'Jogo não encontrado'}), 404
        return jsonify(jogo), 200
    except Exception as exc:
        print(f"Erro ao buscar jogo: {exc}")
        return jsonify({'erro': 'Erro ao buscar detalhes do jogo'}), 500


@jogos_bp.route('/plataforma/<string:plataforma>', methods=['GET'])
def jogos_por_plataforma(plataforma):
    """Buscar jogos por plataforma."""
    try:
        jogos = jogo_repository.buscar_por_plataforma(plataforma)
        return jsonify({'jogos': jogos}), 200
    except Exception as exc:
        print(f"Erro ao buscar jogos por plataforma: {exc}")
        return jsonify({'erro': 'Erro ao buscar jogos por plataforma'}), 500


@jogos_bp.route('', methods=['POST'])
@jwt_required()
@permission_required('criar')
def criar_jogo():
    """Criar jogo."""
    try:
        payload = jogo_schema.load(request.get_json() or {})
    except ValidationError as exc:
        return jsonify({'erro': 'Payload inválido', 'detalhes': exc.errors}), 400

    try:
        jogo_id = jogo_repository.inserir_jogo({}, payload)
        return jsonify({'mensagem': 'Jogo criado com sucesso!', 'id_midia': jogo_id}), 201
    except Exception as exc:
        print(f"Erro ao criar jogo: {exc}")
        return jsonify({'erro': 'Erro ao criar jogo'}), 500
