"""
Blueprint de utilidades: gêneros, Notificações e saúde (Mídias populares: blueprint `midias`).

As rotas leem os parâmetros, chamam o Catálogo ou as Atualizações e respondem.
Os testes trocam `catalogo` e `atualizacoes` deste módulo; `/health` fala com o
módulo `banco`, que é o que ela mede.
"""
import logging

from flask import Blueprint
from flask_jwt_extended import get_jwt_identity, jwt_required
from spectree import Response

from banco import consultar_um
from contrato import AUTENTICADO, contrato
from repositories.atualizacoes import Atualizacoes
from repositories.catalogo import Catalogo
from schemas.utils import (
    ConsultaGeneros,
    ConsultaNotificacoes,
    NotificacoesMarcadas,
    RespostaGeneros,
    RespostaNotificacoes,
    Saude,
)

logger = logging.getLogger(__name__)

utils_bp = Blueprint('utils', __name__)

catalogo = Catalogo()
atualizacoes = Atualizacoes()


@utils_bp.route('/generos', methods=['GET'])
@contrato.validate(resp=Response(HTTP_200=RespostaGeneros), tags=['utils'])
def listar_generos(query: ConsultaGeneros):
    """Listar gêneros; `?tipo=` só os que se aplicam ao Tipo de mídia."""
    return {'generos': catalogo.generos(query.tipo)}


@utils_bp.route('/notificacoes', methods=['GET'])
@jwt_required()
@contrato.validate(resp=Response(HTTP_200=RespostaNotificacoes), tags=['utils'], security=AUTENTICADO)
def obter_notificacoes(query: ConsultaNotificacoes):
    """As 50 Notificações mais recentes do Usuário; `?nao_lidas=true` só as não lidas."""
    return {'notificacoes': atualizacoes.notificacoes(get_jwt_identity(), query.nao_lidas)}


@utils_bp.route('/notificacoes/marcar-todas-lidas', methods=['PUT'])
@jwt_required()
@contrato.validate(resp=Response(HTTP_200=NotificacoesMarcadas), tags=['utils'], security=AUTENTICADO)
def marcar_todas_lidas():
    """Marcar como lidas todas as Notificações do Usuário."""
    marcadas = atualizacoes.marcar_todas_lidas(get_jwt_identity())
    return {'mensagem': f'{marcadas} notificações marcadas como lidas'}


@utils_bp.route('/health', methods=['GET'])
@contrato.validate(resp=Response(HTTP_200=Saude, HTTP_503=Saude), tags=['utils'])
def health_check():
    """Saúde do sistema: 200 com o PostgreSQL de pé, 503 sem ele."""
    try:
        postgres_ok = consultar_um('SELECT 1 AS ok') == {'ok': 1}
    except Exception:
        logger.warning('Health: PostgreSQL inacessível', exc_info=True)
        postgres_ok = False

    if not postgres_ok:
        return {'status': 'unhealthy', 'postgres': 'disconnected'}, 503
    return {'status': 'healthy', 'postgres': 'connected'}

