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
from integracoes import mal, prazo, servico, sincronizacao_steam
from integracoes.plataforma import (
    ErroDaIntegracao,
    ListaGrandeDemais,
    OrigemIndisponivel,
    PerfilNaoEncontrado,
    PerfilPrivado,
    PlataformaIndisponivel,
)
from schemas.integracoes import (
    ArquivoXml,
    ConexaoIntegracao,
    Integracao,
    NovoVinculo,
    PreviaImportacao,
    RespostaIntegracoes,
    ResultadoImportacao,
    ResultadoSincronizacao,
    VinculoCriado,
)

integracoes_bp = Blueprint('integracoes', __name__)

#: Erro da plataforma -> (status HTTP, código), por `isinstance` na ordem: subclasse herda o da base
#: (ex. `prazo.TempoEsgotado` é `OrigemIndisponivel`, 502).
_ERROS = (
    (PerfilPrivado, 400, CodigoErro.PERFIL_PRIVADO),
    (servico.SemPrevia, 400, CodigoErro.REQUISICAO_INVALIDA),
    (PerfilNaoEncontrado, 404, CodigoErro.PERFIL_NAO_ENCONTRADO),
    (ListaGrandeDemais, 413, CodigoErro.LISTA_GRANDE_DEMAIS),
    (OrigemIndisponivel, 502, CodigoErro.ORIGEM_INDISPONIVEL),
    (PlataformaIndisponivel, 503, CodigoErro.PLATAFORMA_INDISPONIVEL),
)

#: Erros das rotas que falam com a plataforma.
ERROS_DA_PLATAFORMA = {
    'HTTP_400': Erro, 'HTTP_404': Erro, 'HTTP_413': Erro, 'HTTP_502': Erro, 'HTTP_503': Erro, **ERROS_AUTENTICADA,
}


def _erro_da_integracao(erro: ErroDaIntegracao):
    for classe, status, codigo in _ERROS:
        if isinstance(erro, classe):
            return resposta_erro(status, codigo, str(erro))
    return resposta_erro(400, CodigoErro.DADOS_INVALIDOS, str(erro))


def _executar(acao):
    """Roda o caso de uso no prazo da requisição (`integracoes.prazo`) e traduz as exceções do
    serviço para o envelope de erro."""
    try:
        with prazo.na_requisicao():
            return acao()
    except servico.PlataformaDesconhecida:
        return resposta_erro(404, CodigoErro.NAO_ENCONTRADO, 'Plataforma desconhecida')
    except servico.SemConta as erro:
        rotulo = servico.plataforma(str(erro)).rotulo
        return resposta_erro(404, CodigoErro.NAO_ENCONTRADO, f'Conecte o {rotulo} antes de importar')
    except ErroDaIntegracao as erro:
        return _erro_da_integracao(erro)


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
    resp=Response(HTTP_200=ResultadoImportacao, HTTP_404=Erro, HTTP_502=Erro, **ERROS_AUTENTICADA),
    tags=['integracoes'], security=AUTENTICADO,
)
def confirmar_previa(id_previa):
    """Aplicar a prévia na Lista (uma vez só, tudo ou nada): importa as obras que faltam no Catálogo.

    Prazo da requisição vencido responde 502 e a prévia continua valendo (as obras já importadas ficam).
    """
    def acao():
        resultado = servico.confirmar(get_jwt_identity(), id_previa)
        if resultado is None:
            return resposta_erro(404, CodigoErro.NAO_ENCONTRADO, 'Prévia não encontrada ou expirada: gere outra')
        return resultado

    return _executar(acao)


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


@integracoes_bp.route('/vinculos', methods=['POST'])
@jwt_required()
@contrato.validate(
    resp=Response(HTTP_201=VinculoCriado, HTTP_400=Erro, HTTP_404=Erro, HTTP_409=Erro, **ERROS_AUTENTICADA),
    tags=['integracoes'], security=AUTENTICADO,
)
def vincular(json: NovoVinculo):
    """Vincular um Não encontrado a uma Mídia do mesmo Tipo: vale para todos e já aplica o Item na Lista.

    Só aceita o que apareceu como Não encontrado para o Usuário (último resultado ou prévia válida).
    """
    try:
        corpo = servico.vincular(get_jwt_identity(), json.plataforma, json.origem_id, json.id_midia)
    except servico.MidiaInexistente:
        return resposta_erro(404, CodigoErro.NAO_ENCONTRADO, 'Mídia não encontrada')
    except servico.ForaDosNaoEncontrados:
        return resposta_erro(404, CodigoErro.NAO_ENCONTRADO, 'Este item não está nos seus Não encontrados')
    except servico.TipoIncompativel as erro:
        return resposta_erro(400, CodigoErro.DADOS_INVALIDOS, str(erro), {'id_midia': str(erro)})
    except servico.VinculoEmConflito:
        return resposta_erro(409, CodigoErro.CONFLITO, 'Este item já está vinculado a outra Mídia')
    return corpo, 201
