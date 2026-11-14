"""
Blueprint de mídias: adaptador HTTP do Catálogo (`repositories.catalogo`) e das
Atualizações de mídia (`repositories.atualizacoes`).

A rota lê os parâmetros, chama o módulo e responde; entrada e saída seguem os
modelos de `schemas/midias.py` (ADR 0011). Os testes trocam `catalogo` e
`atualizacoes` deste módulo.
"""
from __future__ import annotations

from flask import Blueprint
from flask_jwt_extended import jwt_required
from spectree import Response

from contrato import AUTENTICADO, CodigoErro, Erro, Pagina, contrato, montar_pagina, resposta_erro
from decorators import permission_required
from repositories.atualizacoes import Atualizacoes
from repositories.catalogo import Catalogo
from schemas.midias import (
    AtualizacaoPublicada,
    ConsultaMidias,
    ConsultaPopulares,
    ConsultaTrending,
    CorpoAtualizacao,
    CorpoMidia,
    Midia,
    MidiaAlterada,
    MidiaDetalhe,
    RespostaDistribuicao,
    RespostaPopulares,
    RespostaTrending,
)

midias_bp = Blueprint('midias', __name__)

catalogo = Catalogo()
atualizacoes = Atualizacoes()

#: Filtros de GET /midias, repassados ao Catálogo com o mesmo nome.
FILTROS = (
    'busca', 'genero', 'status', 'autor', 'estudio', 'demografia', 'plataforma', 'desenvolvedor', 'modo_jogo',
    'artista',
)

ERROS_DE_ESCRITA = {'HTTP_401': Erro, 'HTTP_403': Erro, 'HTTP_404': Erro}


def midia_nao_encontrada():
    return resposta_erro(404, CodigoErro.NAO_ENCONTRADO, 'Mídia não encontrada')


@midias_bp.route('', methods=['GET'])
@contrato.validate(resp=Response(HTTP_200=Pagina[Midia]), tags=['midias'])
def listar_midias(query: ConsultaMidias):
    """Listar mídias com filtros por tipo, paginado; `total` conta todas as páginas."""
    filtros = {nome: getattr(query, nome) for nome in FILTROS}
    filtros['ordem'] = query.ordem

    midias = catalogo.buscar(query.tipo, pagina=query.pagina, limite=query.por_pagina, filtros=filtros)
    total = catalogo.contar(query.tipo, filtros)
    return montar_pagina(midias, total, query.pagina, query.por_pagina)


@midias_bp.route('/trending', methods=['GET'])
@contrato.validate(resp=Response(HTTP_200=RespostaTrending), tags=['midias'])
def trending_midias(query: ConsultaTrending):
    """Mídias mais bem avaliadas de um tipo."""
    return {'midias': catalogo.buscar(query.tipo, pagina=1, limite=query.limite, filtros={'ordem': 'nota_media'})}


@midias_bp.route('/populares', methods=['GET'])
@contrato.validate(resp=Response(HTTP_200=RespostaPopulares), tags=['midias'])
def midias_populares(query: ConsultaPopulares):
    """As Mídias com mais Usuários; a nota desempata."""
    return {'midias': catalogo.populares(query.tipo)}


@midias_bp.route('/<string:id_midia>', methods=['GET'])
@contrato.validate(resp=Response(HTTP_200=MidiaDetalhe, HTTP_404=Erro), tags=['midias'])
def detalhes_midia(id_midia):
    """Detalhes completos de qualquer mídia, com as Atualizações mais recentes."""
    midia = catalogo.obter(id_midia)
    if not midia:
        return midia_nao_encontrada()

    return {**midia, 'atualizacoes': atualizacoes.recentes(id_midia)}


@midias_bp.route('/<string:id_midia>', methods=['PUT'])
@jwt_required()
@permission_required('editar')
@contrato.validate(
    resp=Response(HTTP_200=MidiaAlterada, **ERROS_DE_ESCRITA), tags=['midias'], security=AUTENTICADO,
)
def atualizar_midia(id_midia, json: CorpoMidia):
    """Atualizar qualquer mídia pelo id central; grava só os campos enviados do Tipo dela."""
    existente = catalogo.obter(id_midia)
    if not existente:
        return midia_nao_encontrada()

    if not catalogo.atualizar(id_midia, json.campos_do_tipo(existente['tipo'])):
        return midia_nao_encontrada()
    return {'mensagem': 'Mídia atualizada com sucesso'}


@midias_bp.route('/<string:id_midia>', methods=['DELETE'])
@jwt_required()
@permission_required('deletar')
@contrato.validate(
    resp=Response(HTTP_200=MidiaAlterada, **ERROS_DE_ESCRITA), tags=['midias'], security=AUTENTICADO,
)
def deletar_midia(id_midia):
    """Deletar mídia central."""
    if not catalogo.apagar(id_midia):
        return midia_nao_encontrada()
    return {'mensagem': 'Mídia removida com sucesso'}


@midias_bp.route('/<string:id_midia>/atualizacoes', methods=['POST'])
@jwt_required()
@permission_required('criar')
@contrato.validate(
    resp=Response(HTTP_201=AtualizacaoPublicada, **ERROS_DE_ESCRITA), tags=['midias'], security=AUTENTICADO,
)
def criar_atualizacao_midia(id_midia, json: CorpoAtualizacao):
    """Publicar uma Atualização de mídia, notificando quem tem a Mídia na Lista."""
    midia = catalogo.obter(id_midia)
    if not midia:
        return midia_nao_encontrada()

    enviadas = atualizacoes.publicar(
        id_midia, midia['tipo'], json.tipo, json.titulo, json.descricao, json.dados_adicionais,
    )
    return {'mensagem': 'Atualização adicionada!', 'notificacoes_enviadas': enviadas}, 201


@midias_bp.route('/<string:id_midia>/distribuicao', methods=['GET'])
@contrato.validate(resp=Response(HTTP_200=RespostaDistribuicao), tags=['midias'])
def distribuicao_midia(id_midia):
    """Distribuição de status dos usuários para uma mídia."""
    return {'distribuicao': catalogo.distribuicao(id_midia)}
