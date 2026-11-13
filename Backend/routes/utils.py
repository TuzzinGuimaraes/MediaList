"""
Blueprint de utilidades: gêneros, Mídias populares, Notificações e saúde.

As rotas leem os parâmetros, chamam o Catálogo ou as Atualizações e respondem.
Os testes trocam `catalogo` e `atualizacoes` deste módulo; `/health` fala com o
módulo `banco`, que é o que ela mede.
"""
import logging

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from banco import consultar_um
from repositories.atualizacoes import Atualizacoes
from repositories.catalogo import Catalogo

logger = logging.getLogger(__name__)

utils_bp = Blueprint('utils', __name__)

catalogo = Catalogo()
atualizacoes = Atualizacoes()


@utils_bp.route('/generos', methods=['GET'])
def listar_generos():
    """Listar gêneros; `?tipo=` só os que se aplicam ao Tipo ('nim' não casa com 'anime')."""
    return jsonify({'generos': catalogo.generos(request.args.get('tipo'))}), 200


@utils_bp.route('/notificacoes', methods=['GET'])
@jwt_required()
def obter_notificacoes():
    """As 50 Notificações mais recentes do Usuário; `?nao_lidas=true` só as não lidas."""
    apenas_nao_lidas = request.args.get('nao_lidas', 'false').lower() == 'true'
    return jsonify({'notificacoes': atualizacoes.notificacoes(get_jwt_identity(), apenas_nao_lidas)}), 200


@utils_bp.route('/notificacoes/marcar-todas-lidas', methods=['PUT'])
@jwt_required()
def marcar_todas_lidas():
    """Marcar como lidas todas as Notificações do Usuário."""
    marcadas = atualizacoes.marcar_todas_lidas(get_jwt_identity())
    return jsonify({'mensagem': f'{marcadas} notificações marcadas como lidas'}), 200


@utils_bp.route('/health', methods=['GET'])
def health_check():
    """Saúde do sistema: 200 com o PostgreSQL de pé, 503 sem ele."""
    try:
        postgres_ok = consultar_um('SELECT 1 AS ok') == {'ok': 1}
    except Exception:
        logger.warning('Health: PostgreSQL inacessível', exc_info=True)
        postgres_ok = False

    if not postgres_ok:
        return jsonify({'status': 'unhealthy', 'postgres': 'disconnected'}), 503
    return jsonify({'status': 'healthy', 'postgres': 'connected'}), 200


@utils_bp.route('/midias/populares', methods=['GET'])
def midias_populares():
    """As Mídias com mais Usuários; a nota desempata."""
    return jsonify({'midias': catalogo.populares(request.args.get('tipo'))}), 200
