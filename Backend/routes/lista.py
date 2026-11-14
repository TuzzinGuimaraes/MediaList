"""
Blueprint de lista do usuário: adaptador HTTP de `dominio.lista_pessoal`.

Aqui não há regra de Item de lista. A rota faz três coisas: receber o corpo já
validado no formato pelo modelo (`schemas/lista.py`), chamar o módulo com os
campos que vieram e traduzir o `Resultado` para um código HTTP. Escrever regra
aqui é o que deixou a lógica duplicada em três lugares antes.

A leitura é a exceção: `obter_lista_usuario` lê de `itens_lista` direto,
porque não decide nada. Os testes trocam `lista_pessoal` e `itens_lista`.
"""
from flask import Blueprint
from flask_jwt_extended import get_jwt_identity, jwt_required
from spectree import Response

from contrato import AUTENTICADO, ERROS_AUTENTICADA, CodigoErro, Erro, Mensagem, contrato, resposta_erro
from dominio.lista_pessoal import INVALIDO, NAO_ENCONTRADO, NEGADO, ListaPessoal
from repositories.catalogo import Catalogo
from repositories.itens_lista import ItensLista
from schemas.lista import (
    ConsultaLista,
    EdicaoItemLista,
    ItemCriado,
    NovoItemLista,
    ProgressoItemLista,
    RespostaLista,
)

lista_bp = Blueprint('lista', __name__)

itens_lista = ItensLista()
lista_pessoal = ListaPessoal(itens_lista, Catalogo())

#: Resposta única para `nao_encontrado` e `negado`: distinguir os dois revelaria
#: quais Itens existem nas listas dos outros usuários.
ERRO_SEM_ACESSO = 'Item não encontrado ou sem permissão'

#: Respostas de erro comuns às rotas de escrita.
ERROS_DA_ESCRITA = {'HTTP_400': Erro, 'HTTP_403': Erro, **ERROS_AUTENTICADA}


def _campos(corpo) -> dict:
    """O corpo como o módulo espera: só os campos enviados, datas em texto."""
    return corpo.model_dump(mode='json', exclude_unset=True)


def _resposta(resultado, mensagem: str, status_ok: int = 200):
    """Traduz o `Resultado` do módulo para (corpo, código HTTP)."""
    if resultado.bem_sucedido:
        corpo = {'mensagem': mensagem}
        if resultado.id_lista:
            corpo['id_lista'] = resultado.id_lista
        return corpo, status_ok

    if resultado.codigo == INVALIDO:
        return resposta_erro(400, CodigoErro.DADOS_INVALIDOS, _erro_legivel(resultado.detalhes), resultado.detalhes)

    if resultado.codigo in (NAO_ENCONTRADO, NEGADO):
        return resposta_erro(403, CodigoErro.ACESSO_NEGADO, ERRO_SEM_ACESSO)

    # Código novo no módulo sem tradução aqui: melhor 500 do que virar 403 calado.
    raise ValueError(f'Resultado sem tradução HTTP: {resultado.codigo}')


def _erro_legivel(detalhes: dict) -> str:
    """Com um único campo errado, a mensagem dele é melhor que um rótulo genérico."""
    if len(detalhes) == 1:
        return next(iter(detalhes.values()))
    return 'Payload inválido'


def _lista(user_id: str, query: ConsultaLista):
    return {'lista': itens_lista.listar(user_id, tipo=query.tipo, status=query.status_consumo)}


@lista_bp.route('', methods=['GET'])
@jwt_required()
@contrato.validate(resp=Response(HTTP_200=RespostaLista, **ERROS_AUTENTICADA), tags=['lista'], security=AUTENTICADO)
def obter_lista_usuario(query: ConsultaLista):
    """Lista pessoal do Usuário autenticado, em ordem alfabética, com filtro por Tipo e Rótulo de estado."""
    return _lista(get_jwt_identity(), query)


@lista_bp.route('/<string:target_user_id>', methods=['GET'])
@jwt_required()
@contrato.validate(
    resp=Response(HTTP_200=RespostaLista, HTTP_403=Erro, **ERROS_AUTENTICADA), tags=['lista'], security=AUTENTICADO,
)
def obter_lista_usuario_por_id(target_user_id, query: ConsultaLista):
    """Lista pessoal de um Usuário: só o próprio."""
    user_id = get_jwt_identity()
    if target_user_id != user_id:
        return resposta_erro(403, CodigoErro.ACESSO_NEGADO, 'Sem permissão para acessar esta lista')
    return _lista(user_id, query)


def _adicionar(corpo: NovoItemLista):
    resultado = lista_pessoal.adicionar(get_jwt_identity(), _campos(corpo))
    return _resposta(resultado, 'Mídia adicionada à lista!', status_ok=201)


@lista_bp.route('/adicionar', methods=['POST'])
@jwt_required()
@contrato.validate(resp=Response(HTTP_201=ItemCriado, **ERROS_DA_ESCRITA), tags=['lista'], security=AUTENTICADO)
def adicionar_midia_lista(json: NovoItemLista):
    """Pôr uma Mídia na Lista pessoal."""
    return _adicionar(json)


@lista_bp.route('', methods=['POST'])
@jwt_required()
@contrato.validate(resp=Response(HTTP_201=ItemCriado, **ERROS_DA_ESCRITA), tags=['lista'], security=AUTENTICADO)
def adicionar_midia_lista_v2(json: NovoItemLista):
    """Pôr uma Mídia na Lista pessoal (o mesmo que /adicionar)."""
    return _adicionar(json)


@lista_bp.route('/<string:lista_id>/progresso', methods=['PUT'])
@jwt_required()
@contrato.validate(
    resp=Response(HTTP_200=Mensagem, **ERROS_DA_ESCRITA), tags=['lista'], security=AUTENTICADO,
)
def atualizar_progresso(lista_id, json: ProgressoItemLista):
    """Atualizar o Progresso de um Item.

    Teto, promoção a Concluído e dono do Item são decisão do módulo.
    """
    resultado = lista_pessoal.atualizar(get_jwt_identity(), lista_id, _campos(json))
    return _resposta(resultado, 'Progresso atualizado com sucesso!')


@lista_bp.route('/<string:lista_id>', methods=['PUT'])
@jwt_required()
@contrato.validate(
    resp=Response(HTTP_200=Mensagem, **ERROS_DA_ESCRITA), tags=['lista'], security=AUTENTICADO,
)
def atualizar_item_lista(lista_id, json: EdicaoItemLista):
    """Gravar os campos enviados num Item."""
    resultado = lista_pessoal.atualizar(get_jwt_identity(), lista_id, _campos(json))
    return _resposta(resultado, 'Lista atualizada com sucesso!')


@lista_bp.route('/<string:lista_id>', methods=['DELETE'])
@jwt_required()
@contrato.validate(
    resp=Response(HTTP_200=Mensagem, HTTP_403=Erro, **ERROS_AUTENTICADA), tags=['lista'], security=AUTENTICADO,
)
def remover_item_lista(lista_id):
    """Tirar um Item da Lista pessoal."""
    resultado = lista_pessoal.remover(get_jwt_identity(), lista_id)
    return _resposta(resultado, 'Mídia removida da lista')
