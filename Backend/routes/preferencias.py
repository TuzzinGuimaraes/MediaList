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


@preferencias_bp.route('', methods=['GET'])
@jwt_required()
@contrato.validate(
    resp=Response(HTTP_200=RespostaPreferencias, HTTP_404=Erro, **ERROS_AUTENTICADA),
    tags=['preferencias'], security=AUTENTICADO,
)
def obter_preferencias():
    """Preferências do Usuário, com os padrões no que ele não mudou."""
    linha = consultar_um(
        'SELECT preferencias, avisar_noticias, avisar_episodios FROM usuarios WHERE id_usuario = %s',
        (get_jwt_identity(),),
    )
    if linha is None:
        return resposta_erro(404, CodigoErro.NAO_ENCONTRADO, 'Usuário não encontrado')

    salvas = {campo: valor for campo, valor in linha['preferencias'].items() if campo in PADROES}
    return {'preferencias': {
        **PADROES, **salvas,
        'avisar_noticias': linha['avisar_noticias'], 'avisar_episodios': linha['avisar_episodios'],
    }}


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

    avisar_noticias = mudancas.pop('avisar_noticias', None)
    avisar_episodios = mudancas.pop('avisar_episodios', None)
    linhas = executar(
        """
        UPDATE usuarios
        SET preferencias = preferencias || %s::jsonb,
            avisar_noticias = COALESCE(%s::boolean, avisar_noticias),
            avisar_episodios = COALESCE(%s::boolean, avisar_episodios)
        WHERE id_usuario = %s
        """,
        (jsonlib.dumps(mudancas), avisar_noticias, avisar_episodios, get_jwt_identity()),
    )
    return {'mensagem': 'Preferências atualizadas com sucesso!', 'modificado': linhas > 0}
