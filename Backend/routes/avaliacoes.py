"""
Blueprint de avaliações: adaptador HTTP de `dominio.avaliacao`.

A rota lê o corpo, chama o módulo e traduz o `Resultado` para um código HTTP.
A regra (dono, uma por Mídia, escala da nota) é do módulo. Os testes trocam
`avaliacoes` deste módulo.
"""
from flask import Blueprint
from flask_jwt_extended import get_jwt_identity, jwt_required
from spectree import Response

from contrato import AUTENTICADO, ERROS_AUTENTICADA, CodigoErro, Erro, Pagina, contrato, montar_pagina, resposta_erro
from decorators import get_user_permissions
from dominio.avaliacao import CONFLITO, Avaliacoes
from dominio.lista_pessoal import INVALIDO, NAO_ENCONTRADO, NEGADO
from repositories.avaliacoes import AvaliacaoRepository
from repositories.catalogo import Catalogo
from schemas.avaliacoes import (
    AvaliacaoCriada,
    AvaliacaoDaMidia,
    AvaliacaoEditada,
    AvaliacaoRemovida,
    ConsultaAvaliacoes,
    CorpoEdicaoAvaliacao,
    CorpoNovaAvaliacao,
)

avaliacoes_bp = Blueprint('avaliacoes', __name__)

avaliacoes = Avaliacoes(AvaliacaoRepository(), Catalogo())

ERRO_DO_RESULTADO = {
    INVALIDO: (400, CodigoErro.DADOS_INVALIDOS),
    NEGADO: (403, CodigoErro.ACESSO_NEGADO),
    NAO_ENCONTRADO: (404, CodigoErro.NAO_ENCONTRADO),
    CONFLITO: (409, CodigoErro.CONFLITO),
}


def _erro(resultado):
    status, codigo = ERRO_DO_RESULTADO[resultado.codigo]
    return resposta_erro(status, codigo, resultado.erro, resultado.detalhes)


@avaliacoes_bp.route('/<string:id_midia>', methods=['GET'])
@contrato.validate(resp=Response(HTTP_200=Pagina[AvaliacaoDaMidia], HTTP_404=Erro), tags=['avaliacoes'])
def listar_avaliacoes(id_midia, query: ConsultaAvaliacoes):
    """Uma página das Avaliações de uma Mídia, mais recentes primeiro."""
    resultado = avaliacoes.listar(id_midia, query.pagina, query.por_pagina)
    if not resultado.bem_sucedido:
        return _erro(resultado)
    return montar_pagina(resultado.dados['avaliacoes'], resultado.dados['total'], query.pagina, query.por_pagina)


@avaliacoes_bp.route('', methods=['POST'])
@jwt_required()
@contrato.validate(
    resp=Response(HTTP_201=AvaliacaoCriada, HTTP_400=Erro, HTTP_404=Erro, HTTP_409=Erro, **ERROS_AUTENTICADA),
    tags=['avaliacoes'], security=AUTENTICADO,
)
def criar_avaliacao(json: CorpoNovaAvaliacao):
    """Criar a Avaliação do Usuário logado; uma por Mídia."""
    resultado = avaliacoes.criar(get_jwt_identity(), json.model_dump(exclude_unset=True))
    if not resultado.bem_sucedido:
        return _erro(resultado)
    return {
        'mensagem': 'Avaliação criada com sucesso!',
        'id_avaliacao': resultado.dados['id_avaliacao'],
        'nota_media_atualizada': resultado.dados['nota_media'],
        'total_avaliacoes': resultado.dados['total_avaliacoes'],
    }, 201


@avaliacoes_bp.route('/<string:avaliacao_id>', methods=['PUT'])
@jwt_required()
@contrato.validate(
    resp=Response(HTTP_200=AvaliacaoEditada, HTTP_400=Erro, HTTP_403=Erro, **ERROS_AUTENTICADA),
    tags=['avaliacoes'], security=AUTENTICADO,
)
def editar_avaliacao(avaliacao_id, json: CorpoEdicaoAvaliacao):
    """Editar a própria Avaliação; só os campos enviados."""
    resultado = avaliacoes.editar(get_jwt_identity(), avaliacao_id, json.model_dump(exclude_unset=True))
    if not resultado.bem_sucedido:
        return _erro(resultado)
    return {'mensagem': 'Avaliação atualizada com sucesso!', 'nota_media_atualizada': resultado.dados['nota_media']}


@avaliacoes_bp.route('/<string:avaliacao_id>', methods=['DELETE'])
@jwt_required()
@contrato.validate(
    resp=Response(HTTP_200=AvaliacaoRemovida, HTTP_403=Erro, HTTP_404=Erro, **ERROS_AUTENTICADA),
    tags=['avaliacoes'], security=AUTENTICADO,
)
def deletar_avaliacao(avaliacao_id):
    """Deletar avaliação: o autor, ou quem pode moderar."""
    user_id = get_jwt_identity()
    pode_moderar = bool(get_user_permissions(user_id)['pode_moderar'])
    resultado = avaliacoes.apagar(user_id, avaliacao_id, pode_moderar)
    if not resultado.bem_sucedido:
        return _erro(resultado)
    return {'mensagem': 'Avaliação removida com sucesso'}
