"""
Blueprint de Preferências
Endpoints para preferências do usuário (MongoDB)
"""
import logging
from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

import database

logger = logging.getLogger(__name__)

preferencias_bp = Blueprint('preferencias', __name__)

@preferencias_bp.route('', methods=['GET'])
@jwt_required()
def obter_preferencias():
    """Obter preferências do usuário"""
    if database.mongo_db is None or database.preferencias_collection is None:
        return jsonify({
            'preferencias': {
                'tema': 'light',
                'idioma': 'pt-BR',
                'notificacoes_ativas': True
            }
        }), 200

    try:
        user_id = get_jwt_identity()

        preferencias = database.preferencias_collection.find_one(
            {'id_usuario': user_id},
            {'_id': 0}
        )

        if not preferencias:
            # Criar preferências padrão
            preferencias_padrao = {
                'id_usuario': user_id,
                'tema': 'light',
                'idioma': 'pt-BR',
                'notificacoes_ativas': True,
                'data_criacao': datetime.now(),
                'data_atualizacao': datetime.now()
            }
            database.preferencias_collection.insert_one(preferencias_padrao)
            preferencias = preferencias_padrao

        return jsonify({'preferencias': preferencias}), 200
    except Exception:
        logger.exception('Erro ao obter preferências')
        return jsonify({
            'preferencias': {
                'tema': 'light',
                'idioma': 'pt-BR',
                'notificacoes_ativas': True
            }
        }), 200


@preferencias_bp.route('', methods=['PUT'])
@jwt_required()
def atualizar_preferencias():
    """Atualizar preferências do usuário"""
    if database.mongo_db is None or database.preferencias_collection is None:
        return jsonify({'mensagem': 'Preferências salvas localmente (MongoDB indisponível)'}), 200

    try:
        user_id = get_jwt_identity()
        data = request.get_json()

        # Validar campos permitidos
        campos_permitidos = ['tema', 'idioma', 'notificacoes_ativas']
        preferencias_update = {}

        for campo in campos_permitidos:
            if campo in data:
                preferencias_update[campo] = data[campo]

        if not preferencias_update:
            return jsonify({'erro': 'Nenhuma preferência válida fornecida'}), 400

        # Adicionar timestamp
        preferencias_update['data_atualizacao'] = datetime.now()

        # Atualizar ou criar
        result = database.preferencias_collection.update_one(
            {'id_usuario': user_id},
            {
                '$set': preferencias_update,
                '$setOnInsert': {
                    'id_usuario': user_id,
                    'data_criacao': datetime.now()
                }
            },
            upsert=True
        )

        return jsonify({
            'mensagem': 'Preferências atualizadas com sucesso!',
            'modificado': result.modified_count > 0 or result.upserted_id is not None
        }), 200
    except Exception:
        logger.exception('Erro ao atualizar preferências')
        return jsonify({'erro': 'Erro ao atualizar preferências'}), 500

