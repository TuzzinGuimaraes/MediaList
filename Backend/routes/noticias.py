"""
Blueprint de Notícias
"""
import logging
from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

import database
from decorators import permission_required
from parametros import POR_PAGINA_MAX, ler_int

logger = logging.getLogger(__name__)

noticias_bp = Blueprint('noticias', __name__)

@noticias_bp.route('', methods=['GET'])
def listar_noticias():
    """Listar notícias"""
    # Acessar via módulo para pegar valor atualizado
    if database.mongo_db is None or database.noticias_collection is None:
        return jsonify({'noticias': []}), 200

    limite = ler_int('limite', 10, minimo=1, maximo=POR_PAGINA_MAX)
    try:
        noticias = list(database.noticias_collection.find(
            {},
            {'_id': 0}
        ).sort('data_publicacao', -1).limit(limite))

        return jsonify({'noticias': noticias}), 200
    except Exception:
        logger.exception('Erro ao listar notícias')
        return jsonify({'noticias': []}), 200


@noticias_bp.route('', methods=['POST'])
@jwt_required()
@permission_required('criar')
def criar_noticia():
    """Criar notícia"""
    # Acessar via módulo para pegar valor atualizado
    if database.mongo_db is None or database.noticias_collection is None:
        return jsonify({'erro': 'MongoDB não disponível'}), 503

    try:
        data = request.get_json()

        if not data or not data.get('titulo'):
            return jsonify({'erro': 'Título é obrigatório'}), 400

        noticia = {
            'titulo': data['titulo'],
            'conteudo': data.get('conteudo', ''),
            'autor': data.get('autor', 'Admin'),
            'categoria': data.get('categoria', 'geral'),
            'tags': data.get('tags', []),
            'imagem_url': data.get('imagem_url'),
            'data_publicacao': datetime.now(),
            'visualizacoes': 0
        }

        result = database.noticias_collection.insert_one(noticia)

        return jsonify({
            'mensagem': 'Notícia criada!',
            'id': str(result.inserted_id)
        }), 201
    except Exception:
        logger.exception('Erro ao criar notícia')
        return jsonify({'erro': 'Erro ao criar notícia'}), 500

