"""
Blueprint do admin (ADR 0012): os vínculos de origem feitos por Usuários (Q116), com desfazer.
"""
from flask import Blueprint
from flask_jwt_extended import jwt_required
from spectree import Response

from contrato import (
    AUTENTICADO,
    ERROS_AUTENTICADA,
    CodigoErro,
    ConsultaPaginada,
    Erro,
    Mensagem,
    Pagina,
    contrato,
    deslocamento,
    montar_pagina,
    resposta_erro,
)
from decorators import admin_required
from integracoes import vinculos
from schemas.integracoes import VinculoAdmin

admin_bp = Blueprint('admin', __name__)


@admin_bp.route('/vinculos', methods=['GET'])
@jwt_required()
@admin_required
@contrato.validate(
    resp=Response(HTTP_200=Pagina[VinculoAdmin], **ERROS_AUTENTICADA), tags=['admin'], security=AUTENTICADO,
)
def listar_vinculos(query: ConsultaPaginada):
    """Uma página dos vínculos feitos por Usuários, mais recentes primeiro."""
    itens, total = vinculos.listar(query.por_pagina, deslocamento(query))
    return montar_pagina(itens, total, query.pagina, query.por_pagina)


@admin_bp.route('/vinculos/<string:id_vinculo>', methods=['DELETE'])
@jwt_required()
@admin_required
@contrato.validate(
    resp=Response(HTTP_200=Mensagem, HTTP_404=Erro, **ERROS_AUTENTICADA), tags=['admin'], security=AUTENTICADO,
)
def desfazer_vinculo(id_vinculo):
    """Desfazer um vínculo: os Itens já gravados ficam; a próxima importação volta a dar Não encontrado."""
    if not vinculos.desfazer(id_vinculo):
        return resposta_erro(404, CodigoErro.NAO_ENCONTRADO, 'Vínculo não encontrado')
    return {'mensagem': 'Vínculo desfeito'}
