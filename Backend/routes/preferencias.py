"""
Blueprint de Preferências: `usuarios.preferencias` (jsonb).

O jsonb guarda só o que o Usuário mudou; a leitura completa com os padrões.
"""
import json as jsonlib

from flask import Blueprint
from flask_jwt_extended import get_jwt_identity, jwt_required
from spectree import Response

from banco import consultar_um, executar
from contrato import AUTENTICADO, ERROS_AUTENTICADA, CodigoErro, Erro, contrato, resposta_erro
from schemas.preferencias import CorpoPreferencias, PreferenciasAtualizadas, RespostaPreferencias

preferencias_bp = Blueprint('preferencias', __name__)

PADROES = {'tema': 'light', 'idioma': 'pt-BR', 'notificacoes_ativas': True}


@preferencias_bp.route('', methods=['GET'])
@jwt_required()
@contrato.validate(
    resp=Response(HTTP_200=RespostaPreferencias, HTTP_404=Erro, **ERROS_AUTENTICADA),
    tags=['preferencias'], security=AUTENTICADO,
)
def obter_preferencias():
    """Preferências do Usuário, com os padrões no que ele não mudou."""
    linha = consultar_um('SELECT preferencias FROM usuarios WHERE id_usuario = %s', (get_jwt_identity(),))
    if linha is None:
        return resposta_erro(404, CodigoErro.NAO_ENCONTRADO, 'Usuário não encontrado')

    salvas = {campo: valor for campo, valor in linha['preferencias'].items() if campo in PADROES}
    return {'preferencias': {**PADROES, **salvas}}


@preferencias_bp.route('', methods=['PUT'])
@jwt_required()
@contrato.validate(
    resp=Response(HTTP_200=PreferenciasAtualizadas, **ERROS_AUTENTICADA), tags=['preferencias'], security=AUTENTICADO,
)
def atualizar_preferencias(json: CorpoPreferencias):
    """Grava os campos enviados; os outros ficam como estão."""
    mudancas = json.model_dump(exclude_none=True) if json is not None else {}
    if not mudancas:
        return resposta_erro(400, CodigoErro.DADOS_INVALIDOS, 'Nenhuma preferência válida fornecida')

    linhas = executar(
        'UPDATE usuarios SET preferencias = preferencias || %s::jsonb WHERE id_usuario = %s',
        (jsonlib.dumps(mudancas), get_jwt_identity()),
    )
    return {'mensagem': 'Preferências atualizadas com sucesso!', 'modificado': linhas > 0}
