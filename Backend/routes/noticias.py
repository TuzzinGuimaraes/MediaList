"""
Blueprint de Notícias
"""
from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

import database
from decorators import permission_required

noticias_bp = Blueprint('noticias', __name__)

@noticias_bp.route('', methods=['GET'])
def listar_noticias():
    """Listar notícias"""
    # Acessar via módulo para pegar valor atualizado
    if database.mongo_db is None or database.noticias_collection is None:
        print("⚠️ MongoDB ou noticias_collection é None no endpoint de listagem")
        return jsonify({'noticias': []}), 200

    try:
        limite = int(request.args.get('limite', 10))

        noticias = list(database.noticias_collection.find(
            {},
            {'_id': 0}
        ).sort('data_publicacao', -1).limit(limite))

        print(f"✅ Notícias encontradas: {len(noticias)}")
        return jsonify({'noticias': noticias}), 200
    except Exception as e:
        print(f"❌ Erro ao listar notícias: {e}")
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
    except Exception as e:
        print(f"Erro ao criar notícia: {e}")
        return jsonify({'erro': 'Erro ao criar notícia'}), 500

