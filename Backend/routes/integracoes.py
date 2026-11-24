"""
Blueprint de Integrações (ADR 0015): adaptador HTTP de `integracoes.servico`.

`<plataforma>` é um nome de `integracoes.servico.PLATAFORMAS`; fora dele, 404. Os erros da
plataforma viram o envelope de erro com um `codigo` próprio e a mensagem para a tela.
"""
from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from spectree import Response
from werkzeug.exceptions import RequestEntityTooLarge

from contrato import AUTENTICADO, ERROS_AUTENTICADA, CodigoErro, Erro, Mensagem, contrato, resposta_erro
from integracoes import mal, servico, sincronizacao_steam
from integracoes.plataforma import (
    ErroDaIntegracao,
    OrigemIndisponivel,
    PerfilNaoEncontrado,
    PerfilPrivado,
    PlataformaIndisponivel,
)
from schemas.integracoes import (
    ArquivoXml,
    ConexaoIntegracao,
    Integracao,
    PreviaImportacao,
    RespostaIntegracoes,
    ResultadoImportacao,
    ResultadoSincronizacao,
)

integracoes_bp = Blueprint('integracoes', __name__)

#: Erro da plataforma -> (status HTTP, código).
_ERROS = {
    PerfilPrivado: (400, CodigoErro.PERFIL_PRIVADO),
    PerfilNaoEncontrado: (404, CodigoErro.PERFIL_NAO_ENCONTRADO),
    OrigemIndisponivel: (502, CodigoErro.ORIGEM_INDISPONIVEL),
    PlataformaIndisponivel: (503, CodigoErro.PLATAFORMA_INDISPONIVEL),
}

#: Erros das rotas que falam com a plataforma.
ERROS_DA_PLATAFORMA = {
    'HTTP_400': Erro, 'HTTP_404': Erro, 'HTTP_502': Erro, 'HTTP_503': Erro, **ERROS_AUTENTICADA,
}


def _executar(acao):
    """Roda o caso de uso e traduz as exceções do serviço para o envelope de erro."""
    try:
        return acao()
    except servico.PlataformaDesconhecida:
        return resposta_erro(404, CodigoErro.NAO_ENCONTRADO, 'Plataforma desconhecida')
    except servico.SemConta as erro:
        rotulo = servico.plataforma(str(erro)).rotulo
        return resposta_erro(404, CodigoErro.NAO_ENCONTRADO, f'Conecte o {rotulo} antes de importar')
    except ErroDaIntegracao as erro:
        status, codigo = _ERROS[type(erro)]
        return resposta_erro(status, codigo, str(erro))


@integracoes_bp.route('', methods=['GET'])
@jwt_required()
@contrato.validate(
    resp=Response(HTTP_200=RespostaIntegracoes, **ERROS_AUTENTICADA), tags=['integracoes'], security=AUTENTICADO,
)
def listar_integracoes():
    """As plataformas de Integração e as contas conectadas do Usuário."""
    return {'integracoes': servico.listar(get_jwt_identity())}


@integracoes_bp.route('/<string:plataforma>', methods=['PUT'])
@jwt_required()
@contrato.validate(
    resp=Response(HTTP_200=Integracao, **ERROS_DA_PLATAFORMA), tags=['integracoes'], security=AUTENTICADO,
)
def conectar_integracao(plataforma, json: ConexaoIntegracao):
    """Conectar (ou trocar) a conta pública: valida que o perfil existe e é público."""
    return _executar(lambda: servico.conectar(get_jwt_identity(), plataforma, json.identificador))


@integracoes_bp.route('/<string:plataforma>', methods=['DELETE'])
@jwt_required()
@contrato.validate(
    resp=Response(HTTP_200=Mensagem, HTTP_404=Erro, **ERROS_AUTENTICADA), tags=['integracoes'], security=AUTENTICADO,
)
def desconectar_integracao(plataforma):
    """Desconectar a conta. A Lista fica como está."""
    def acao():
        servico.desconectar(get_jwt_identity(), plataforma)
        return {'mensagem': 'Conta desconectada'}

    return _executar(acao)


@integracoes_bp.route('/<string:plataforma>/previa', methods=['POST'])
@jwt_required()
@contrato.validate(
    resp=Response(HTTP_200=PreviaImportacao, **ERROS_DA_PLATAFORMA), tags=['integracoes'], security=AUTENTICADO,
)
def previa_integracao(plataforma):
    """Prévia da importação: contagens e Não encontrados, sem gravar. Vale 1 h, só para o dono."""
    return _executar(lambda: servico.previa(get_jwt_identity(), plataforma))


@integracoes_bp.before_request
def _limitar_o_xml():
    """O upload do XML para de ler no limite (com folga para o envelope multipart)."""
    if request.endpoint == 'integracoes.previa_do_xml_do_mal':
        request.max_content_length = mal.LIMITE_XML + 64 * 1024


@integracoes_bp.errorhandler(RequestEntityTooLarge)
def _xml_grande_demais(_erro):
    return resposta_erro(413, CodigoErro.DADOS_INVALIDOS, mal.MENSAGEM_GRANDE)


@integracoes_bp.route('/mal/xml', methods=['POST'])
@jwt_required()
@contrato.validate(
    form=ArquivoXml, resp=Response(HTTP_200=PreviaImportacao, HTTP_400=Erro, HTTP_413=Erro, HTTP_502=Erro,
                                   **ERROS_AUTENTICADA),
    tags=['integracoes'], security=AUTENTICADO,
)
def previa_do_xml_do_mal(form: ArquivoXml):
    """Prévia a partir do XML exportado do MyAnimeList (só web). Não precisa conectar nem da chave do MAL."""
    arquivo = request.files.get('arquivo')
    if arquivo is None:
        return resposta_erro(400, CodigoErro.DADOS_INVALIDOS, mal.MENSAGEM_ARQUIVO, {'arquivo': 'Campo obrigatório'})
    conteudo = arquivo.stream.read(mal.LIMITE_XML + 1)

    def acao():
        try:
            itens = servico.plataforma('mal').itens_do_xml(conteudo)
        except mal.ArquivoGrandeDemais as erro:
            return resposta_erro(413, CodigoErro.DADOS_INVALIDOS, str(erro))
        except mal.ArquivoInvalido as erro:
            return resposta_erro(400, CodigoErro.DADOS_INVALIDOS, str(erro))
        return servico.previa_de_itens(get_jwt_identity(), 'mal', itens)

    return _executar(acao)


@integracoes_bp.route('/previas/<string:id_previa>/confirmar', methods=['POST'])
@jwt_required()
@contrato.validate(
    resp=Response(HTTP_200=ResultadoImportacao, HTTP_404=Erro, **ERROS_AUTENTICADA),
    tags=['integracoes'], security=AUTENTICADO,
)
def confirmar_previa(id_previa):
    """Aplicar a prévia na Lista (uma vez só): importa as obras que faltam no Catálogo."""
    resultado = servico.confirmar(get_jwt_identity(), id_previa)
    if resultado is None:
        return resposta_erro(404, CodigoErro.NAO_ENCONTRADO, 'Prévia não encontrada ou expirada: gere outra')
    return resultado


@integracoes_bp.route('/steam/sincronizar', methods=['POST'])
@jwt_required()
@contrato.validate(
    resp=Response(HTTP_200=ResultadoSincronizacao, **ERROS_DA_PLATAFORMA), tags=['integracoes'], security=AUTENTICADO,
)
def sincronizar_steam():
    """Sincronizar agora: grava as horas dos jogos já casados e casa os novos até o orçamento (~60 s).

    Os que não couberem voltam em `pendentes` e ficam para a sincronização diária.
    """
    return _executar(lambda: sincronizacao_steam.sincronizar(
        get_jwt_identity(), orcamento=sincronizacao_steam.ORCAMENTO_SEGUNDOS,
    ))
