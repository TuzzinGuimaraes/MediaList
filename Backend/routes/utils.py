"""
Blueprint de utilidades.
"""
import logging

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

import database
from banco import consultar, consultar_um
from repositories.midia_repository import origem_nota

logger = logging.getLogger(__name__)

utils_bp = Blueprint('utils', __name__)


@utils_bp.route('/generos', methods=['GET'])
def listar_generos():
    """Listar gêneros, opcionalmente filtrando por tipo.

    `aplicavel_a` é text[] e sai como lista no JSON. O filtro casa o elemento
    inteiro (índice GIN): '?tipo=nim' não casa com 'anime'.
    """
    tipo = request.args.get('tipo')
    if tipo:
        generos = consultar(
            "SELECT * FROM generos WHERE aplicavel_a @> ARRAY[%s]::text[] ORDER BY nome_genero",
            (tipo,),
        )
    else:
        generos = consultar("SELECT * FROM generos ORDER BY nome_genero")
    return jsonify({'generos': generos}), 200


@utils_bp.route('/notificacoes', methods=['GET'])
@jwt_required()
def obter_notificacoes():
    """Obter notificações do usuário."""
    if database.mongo_db is None or database.notificacoes_collection is None:
        return jsonify({'notificacoes': []}), 200

    try:
        user_id = get_jwt_identity()
        apenas_nao_lidas = request.args.get('nao_lidas', 'false').lower() == 'true'

        filtro = {'id_usuario': user_id}
        if apenas_nao_lidas:
            filtro['lida'] = False

        notificacoes = list(
            database.notificacoes_collection.find(filtro, {'_id': 0}).sort('data_criacao', -1).limit(50)
        )
        return jsonify({'notificacoes': notificacoes}), 200
    except Exception:
        logger.exception('Erro ao obter notificações')
        return jsonify({'notificacoes': []}), 200


@utils_bp.route('/notificacoes/marcar-todas-lidas', methods=['PUT'])
@jwt_required()
def marcar_todas_lidas():
    """Marcar notificações como lidas."""
    if database.mongo_db is None or database.notificacoes_collection is None:
        return jsonify({'mensagem': 'MongoDB não disponível'}), 200

    try:
        user_id = get_jwt_identity()
        result = database.notificacoes_collection.update_many(
            {'id_usuario': user_id, 'lida': False},
            {'$set': {'lida': True}},
        )
        return jsonify({'mensagem': f'{result.modified_count} notificações marcadas como lidas'}), 200
    except Exception:
        logger.exception('Erro ao marcar notificações')
        return jsonify({'erro': 'Erro ao marcar notificações'}), 500


@utils_bp.route('/health', methods=['GET'])
def health_check():
    """Saúde do sistema: 503 sem PostgreSQL; sem Mongo, 200 'degraded'."""
    try:
        postgres_ok = consultar_um('SELECT 1 AS ok') == {'ok': 1}
    except Exception:
        logger.warning('Health: PostgreSQL inacessível', exc_info=True)
        postgres_ok = False

    mongodb_ok = database.mongo_db is not None
    if not postgres_ok:
        status, codigo = 'unhealthy', 503
    else:
        status, codigo = ('healthy', 200) if mongodb_ok else ('degraded', 200)

    return jsonify({
        'status': status,
        'postgres': 'connected' if postgres_ok else 'disconnected',
        'mongodb': 'connected' if mongodb_ok else 'disconnected',
    }), codigo


#: Popularidade primeiro; a nota (Nota média, senão a da fonte) desempata.
POPULARES = f"""
    SELECT p.*, {origem_nota('p.nota_fonte')} AS origem_nota
    FROM vw_midias_populares p
    LEFT JOIN animes a ON a.id_midia = p.id_midia
    LEFT JOIN mangas ma ON ma.id_midia = p.id_midia
    LEFT JOIN jogos j ON j.id_midia = p.id_midia
    WHERE %(tipo)s::text IS NULL OR p.tipo = %(tipo)s
    ORDER BY p.total_usuarios DESC, COALESCE(p.nota_media, p.nota_fonte) DESC NULLS LAST, p.id_midia
    LIMIT 20
"""


@utils_bp.route('/midias/populares', methods=['GET'])
def midias_populares():
    """Mídias mais populares."""
    midias = consultar(POPULARES, {'tipo': request.args.get('tipo') or None})
    return jsonify({'midias': midias}), 200


@utils_bp.route('/animes/populares', methods=['GET'])
def animes_populares():
    """Compatibilidade para populares de animes."""
    animes = consultar(POPULARES, {'tipo': 'anime'})
    return jsonify({'animes': animes}), 200


@utils_bp.route('/animes/temporada', methods=['GET'])
def animes_temporada():
    """Animes da temporada atual."""
    return jsonify({'animes': consultar("SELECT * FROM vw_animes_temporada_atual")}), 200
