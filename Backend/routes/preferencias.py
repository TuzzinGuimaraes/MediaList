"""
Blueprint de Preferências: `usuarios.preferencias` (jsonb).

O jsonb guarda só o que o Usuário mudou; a leitura completa com os padrões.
`avisar_noticias` ("Avisar sobre Notícias") e `avisar_episodios` ("Avisar sobre episódios novos"),
os push do app, são colunas próprias de `usuarios`, porque o envio filtra por elas; saem e entram
junto com as outras.
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
#: Os push do app: colunas de `usuarios`, não chaves do jsonb.
AVISOS = ('avisar_noticias', 'avisar_episodios')

_SELECT = f'SELECT preferencias, {", ".join(AVISOS)} FROM usuarios WHERE id_usuario = %s'
_UPDATE = (
    'UPDATE usuarios SET preferencias = preferencias || %s::jsonb, '
    + ', '.join(f'{aviso} = COALESCE(%s::boolean, {aviso})' for aviso in AVISOS)
    + ' WHERE id_usuario = %s'
)


@preferencias_bp.route('', methods=['GET'])
@jwt_required()
@contrato.validate(
    resp=Response(HTTP_200=RespostaPreferencias, HTTP_404=Erro, **ERROS_AUTENTICADA),
    tags=['preferencias'], security=AUTENTICADO,
)
def obter_preferencias():
    """Preferências do Usuário, com os padrões no que ele não mudou."""
    linha = consultar_um(_SELECT, (get_jwt_identity(),))
    if linha is None:
        return resposta_erro(404, CodigoErro.NAO_ENCONTRADO, 'Usuário não encontrado')

    salvas = {campo: valor for campo, valor in linha['preferencias'].items() if campo in PADROES}
    return {'preferencias': {**PADROES, **salvas, **{aviso: linha[aviso] for aviso in AVISOS}}}


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

    avisos = [mudancas.pop(aviso, None) for aviso in AVISOS]
    linhas = executar(_UPDATE, (jsonlib.dumps(mudancas), *avisos, get_jwt_identity()))
    return {'mensagem': 'Preferências atualizadas com sucesso!', 'modificado': linhas > 0}
