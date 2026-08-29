"""
Blueprint de utilidades.
"""
import database
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from database import execute_query

utils_bp = Blueprint('utils', __name__)


def _serializar_genero(genero: dict) -> dict:
    """Converte `aplicavel_a` de SET do MySQL para lista.

    O conector devolve colunas SET como `set` do Python, que o jsonify não
    serializa — sem esta conversão a rota inteira responde 500. A lista também
    é a forma correta no JSON: um gênero se aplica a um conjunto de tipos.
    """
    aplicavel_a = genero.get('aplicavel_a')
    if isinstance(aplicavel_a, (set, frozenset)):
        genero = {**genero, 'aplicavel_a': sorted(aplicavel_a)}
    return genero


@utils_bp.route('/generos', methods=['GET'])
def listar_generos():
    """Listar gêneros, opcionalmente filtrando por tipo."""
    try:
        tipo = request.args.get('tipo')
        if tipo:
            # FIND_IN_SET casa o elemento inteiro. Um LIKE '%tipo%' aqui daria
            # falso positivo — '?tipo=nim' casaria com 'anime'.
            generos = execute_query(
                "SELECT * FROM generos WHERE FIND_IN_SET(%s, aplicavel_a) > 0 ORDER BY nome_genero",
                (tipo,),
            )
        else:
            generos = execute_query("SELECT * FROM generos ORDER BY nome_genero")
        return jsonify({'generos': [_serializar_genero(g) for g in (generos or [])]}), 200
    except Exception as exc:
        print(f"Erro ao listar gêneros: {exc}")
        return jsonify({'erro': 'Erro ao buscar gêneros'}), 500


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
    except Exception as exc:
        print(f"Erro ao obter notificações: {exc}")
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
    except Exception as exc:
        print(f"Erro ao marcar notificações: {exc}")
        return jsonify({'erro': 'Erro ao marcar notificações'}), 500


@utils_bp.route('/health', methods=['GET'])
def health_check():
    """Verificar saúde do sistema."""
    try:
        mysql_ok = False
        try:
            result = execute_query("SELECT 1 as test")
            mysql_ok = result is not None
        except Exception:
            pass

        mongodb_ok = database.mongo_db is not None
        return jsonify({
            'status': 'healthy' if mysql_ok else 'degraded',
            'mysql': 'connected' if mysql_ok else 'disconnected',
            'mongodb': 'connected' if mongodb_ok else 'disconnected',
        }), 200
    except Exception as exc:
        return jsonify({'status': 'unhealthy', 'erro': str(exc)}), 500


@utils_bp.route('/midias/populares', methods=['GET'])
def midias_populares():
    """Mídias mais populares."""
    try:
        tipo = request.args.get('tipo')
        if tipo:
            query = "SELECT * FROM vw_midias_populares WHERE tipo = %s LIMIT 20"
            midias = execute_query(query, (tipo,))
        else:
            midias = execute_query("SELECT * FROM vw_midias_populares LIMIT 20")
        return jsonify({'midias': midias or []}), 200
    except Exception as exc:
        print(f"Erro ao buscar populares: {exc}")
        return jsonify({'erro': 'Erro ao buscar mídias populares'}), 500


@utils_bp.route('/animes/populares', methods=['GET'])
def animes_populares():
    """Compatibilidade para populares de animes."""
    try:
        animes = execute_query("SELECT * FROM vw_midias_populares WHERE tipo = 'anime' LIMIT 20")
        return jsonify({'animes': animes or []}), 200
    except Exception as exc:
        print(f"Erro ao buscar animes populares: {exc}")
        return jsonify({'erro': 'Erro ao buscar animes populares'}), 500


@utils_bp.route('/animes/temporada', methods=['GET'])
def animes_temporada():
    """Animes da temporada atual."""
    try:
        animes = execute_query("SELECT * FROM vw_animes_temporada_atual")
        return jsonify({'animes': animes or []}), 200
    except Exception as exc:
        print(f"Erro ao buscar temporada: {exc}")
        return jsonify({'erro': 'Erro ao buscar animes da temporada'}), 500
