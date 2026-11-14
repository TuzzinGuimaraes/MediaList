"""Contrato da API: SpecTree + Pydantic v2 (ADR 0011).

Uma instância só, `contrato`, usada nos blueprints:

    @bp.route('/generos', methods=['GET'])
    @contrato.validate(resp=Response(HTTP_200=RespostaGeneros), tags=['utils'])
    def listar_generos(query: ConsultaGeneros): ...

- **Entrada:** `query`, `json`... por anotação no parâmetro da rota. Entrada fora
  do modelo responde 400 no envelope de erro, com `detalhes` traduzidos.
- **Saída:** a resposta passa pelo modelo e sai serializada por ele: só os campos
  declarados, IDs como texto, datas `YYYY-MM-DD`, instantes ISO 8601 com fuso.
- **Resposta fora do modelo:** com `CONTRATO_RESPOSTA_ESTRITA` (ligado no
  conftest) responde 500 com os erros do Pydantic, e o teste falha. Sem a flag
  (produção), sai a resposta original, sem passar pelo modelo, e o desvio vai
  para o log. O SpecTree sozinho sempre troca a resposta por 500; o plugin abaixo
  é o que faz o modo só-log.
"""
from __future__ import annotations

import logging
import re
from datetime import date
from enum import StrEnum
from typing import Annotated, Any, Literal

from flask import current_app, jsonify, make_response, redirect, request
from pydantic import AfterValidator, AwareDatetime, BaseModel, BeforeValidator, Field, model_serializer
from pydantic_core import PydanticCustomError
from spectree import SecurityScheme, SpecTree
from spectree.models import SecuritySchemeData
from spectree.page import PAGE_TEMPLATES
from spectree.plugins.flask_plugin import FlaskPlugin

logger = logging.getLogger(__name__)


# ============================================
# Envelope de erro
# ============================================

class CodigoErro(StrEnum):
    """Código estável do erro, para o cliente decidir sem ler a mensagem."""

    DADOS_INVALIDOS = 'dados_invalidos'
    REQUISICAO_INVALIDA = 'requisicao_invalida'
    NAO_AUTENTICADO = 'nao_autenticado'
    TOKEN_EXPIRADO = 'token_expirado'
    TOKEN_INVALIDO = 'token_invalido'
    TOKEN_REVOGADO = 'token_revogado'
    SESSAO_INVALIDA = 'sessao_invalida'
    ACESSO_NEGADO = 'acesso_negado'
    NAO_ENCONTRADO = 'nao_encontrado'
    METODO_NAO_PERMITIDO = 'metodo_nao_permitido'
    CONFLITO = 'conflito'
    INDISPONIVEL = 'indisponivel'
    ERRO_INTERNO = 'erro_interno'


class Erro(BaseModel):
    """Envelope de todo erro da API."""

    erro: str = Field(description='Mensagem para a tela, em português')
    codigo: CodigoErro
    detalhes: dict[str, str] | None = Field(default=None, description='Motivo por campo, nos erros de validação')

    @model_serializer(mode='wrap')
    def _sem_detalhes_vazios(self, serializar):
        """Sem `detalhes`, a chave não sai (igual a `resposta_erro`)."""
        dados = serializar(self)
        if dados.get('detalhes') is None:
            dados.pop('detalhes', None)
        return dados


def resposta_erro(status: int, codigo: CodigoErro, erro: str, detalhes: dict[str, str] | None = None):
    """(resposta, status) no envelope de erro; `detalhes` só aparece quando há."""
    corpo: dict[str, Any] = {'erro': erro, 'codigo': codigo.value}
    if detalhes:
        corpo['detalhes'] = detalhes
    return jsonify(corpo), status


# Tipos de erro do Pydantic com tradução; o resto vira "Valor inválido".
_MENSAGENS = {
    'missing': 'Campo obrigatório',
    'literal_error': 'Valor fora dos permitidos',
    'enum': 'Valor fora dos permitidos',
    'greater_than': 'Deve ser maior que {gt}',
    'greater_than_equal': 'Deve ser maior ou igual a {ge}',
    'less_than': 'Deve ser menor que {lt}',
    'less_than_equal': 'Deve ser menor ou igual a {le}',
    'string_too_short': 'Deve ter no mínimo {min_length} caracteres',
    'string_too_long': 'Deve ter no máximo {max_length} caracteres',
    'too_short': 'Deve ter no mínimo {min_length} itens',
    'too_long': 'Deve ter no máximo {max_length} itens',
}


def _mensagem(erro: dict[str, Any]) -> str:
    tipo = erro['type']
    if tipo in _MENSAGENS:
        return _MENSAGENS[tipo].format(**erro.get('ctx', {}))
    if tipo.endswith(('_type', '_parsing')):
        return 'Tipo inválido'
    return 'Valor inválido'


def detalhes_de_validacao(erros: list[dict[str, Any]]) -> dict[str, str]:
    """`{campo: motivo}` a partir de `ValidationError.errors()`; o primeiro motivo de cada campo."""
    detalhes: dict[str, str] = {}
    for erro in erros:
        campo = '.'.join(str(parte) for parte in erro['loc']) or 'payload'
        detalhes.setdefault(campo, _mensagem(erro))
    return detalhes


# ============================================
# Formatos comuns
# ============================================

def _id_como_texto(valor: Any) -> Any:
    if isinstance(valor, int) and not isinstance(valor, bool):
        return str(valor)
    return valor


def _numero_nao_booleano(valor: Any) -> Any:
    # Sem isto o Pydantic aceitaria `true` como 1.0.
    if isinstance(valor, bool):
        raise PydanticCustomError('float_type', 'Deve ser número')
    return valor


#: IDs saem como texto, mesmo quando a coluna é inteira.
Id = Annotated[str, BeforeValidator(_id_como_texto)]
#: Avaliação, Nota pessoal, Nota média e Nota da fonte: número de 0 a 10 (ADR 0010), na
#: entrada e na saída. A casa decimal única quem confere é `dominio.nota`.
Nota = Annotated[float, BeforeValidator(_numero_nao_booleano), Field(ge=0, le=10)]
#: Data sem hora, `YYYY-MM-DD`.
Data = date
#: Instante com fuso, ISO 8601.
Instante = AwareDatetime
TipoDeMidia = Literal['anime', 'manga', 'jogo']


def _vazio_como_ausente(valor: Any) -> Any:
    return None if isinstance(valor, str) and valor.strip() == '' else valor


#: Campo opcional em que texto vazio vale como ausente (`?tipo=` é não filtrar; no corpo, grava nulo).
#: Uso: `tipo: Annotated[TipoDeMidia | None, VazioComoAusente] = None`.
VazioComoAusente = BeforeValidator(_vazio_como_ausente)
#: Texto opcional: vazio vale como ausente.
TextoOpcional = Annotated[str | None, VazioComoAusente]
#: Texto obrigatório e não vazio.
Preenchido = Annotated[str, Field(min_length=1)]


class Mensagem(BaseModel):
    """Resposta que só confirma a operação."""

    mensagem: str


# ============================================
# Paginação
# ============================================

#: Teto de itens por página (e do `limite` de trending) em toda listagem.
POR_PAGINA_MAX = 50
POR_PAGINA_PADRAO = 20

#: Quantidade pedida pelo cliente: de 1 em diante; acima do teto vira o teto (não é erro).
PorPagina = Annotated[
    int, Field(ge=1, description=f'Acima de {POR_PAGINA_MAX} vira {POR_PAGINA_MAX}'),
    AfterValidator(lambda valor: min(valor, POR_PAGINA_MAX)),
]


class ConsultaPaginada(BaseModel):
    """`?pagina=&por_pagina=`. Herde para somar filtros."""

    pagina: int = Field(default=1, ge=1)
    por_pagina: PorPagina = POR_PAGINA_PADRAO


class Pagina[T](BaseModel):
    """Envelope de listagem paginada."""

    itens: list[T]
    pagina: int
    por_pagina: int
    total: int = Field(description='Total de itens em todas as páginas')


def montar_pagina(itens: list[Any], total: int, pagina: int, por_pagina: int) -> dict[str, Any]:
    """Corpo de `Pagina[T]`; `pagina` e `por_pagina` vêm da `ConsultaPaginada`."""
    return {'itens': itens, 'pagina': pagina, 'por_pagina': por_pagina, 'total': total}


def deslocamento(query: ConsultaPaginada) -> int:
    """O OFFSET da página pedida: quantos itens vêm antes dela."""
    return (query.pagina - 1) * query.por_pagina


# ============================================
# SpecTree
# ============================================

class PluginContrato(FlaskPlugin):
    """Plugin Flask do SpecTree com a validação da resposta do MediaList.

    Sempre serializa pelo modelo (`force_resp_serialize`). Resposta fora do
    modelo: 500 com `CONTRATO_RESPOSTA_ESTRITA`; senão, log e resposta original.
    """

    def validate_response(self, resp, resp_model, skip_validation, force_resp_serialize):
        resposta, erro = super().validate_response(resp, resp_model, skip_validation, True)
        if erro is None:
            return resposta, erro
        logger.warning(
            'Resposta fora do contrato em %s %s: %s', request.method, request.path, erro.errors(include_url=False),
        )
        if current_app.config.get('CONTRATO_RESPOSTA_ESTRITA', False):
            return resposta, erro
        return make_response(resp), erro


def _entrada_invalida(_req, _resp, erro_validacao, _instancia, _adaptador):
    """Entrada fora do modelo: o errorhandler do Pydantic no app monta o envelope."""
    if erro_validacao is not None:
        raise erro_validacao


def _nome_do_modelo(modelo: Any) -> str:
    """Nome do schema no OpenAPI: o da classe, sem hash (`Pagina[Midia]` vira `PaginaMidia`)."""
    return re.sub(r'[^A-Za-z0-9]', '', getattr(modelo, '__name__', str(modelo)))


contrato = SpecTree(
    'flask',
    backend=PluginContrato,
    before=_entrada_invalida,
    validation_error_status=400,
    validation_error_model=Erro,
    naming_strategy=_nome_do_modelo,
    nested_naming_strategy=lambda _pai, filho: filho,
    title='MediaList API',
    version='1.0.0',
    mode='strict',
    # Não pode ser só 'api': o SpecTree ignora no documento toda rota sob `/{path}`.
    path='api/docs',
    filename='openapi.json',
    page_templates={'swagger': PAGE_TEMPLATES['swagger'], 'redoc': PAGE_TEMPLATES['redoc']},
    security_schemes=[
        SecurityScheme(name='bearer', data=SecuritySchemeData(type='http', scheme='bearer', bearer_format='JWT')),
    ],
)

#: `security=` das rotas com `@jwt_required()`.
AUTENTICADO = {'bearer': []}
#: `security=` das rotas com `@jwt_required(optional=True)`: sem token também vale.
AUTENTICACAO_OPCIONAL = [{}, AUTENTICADO]

#: Erros de toda rota com `@jwt_required()`, vindos dos loaders do flask-jwt (app.py): 401 sem
#: token, expirado, revogado ou de Usuário desativado; 422 com o token malformado.
#: Uso: `resp=Response(HTTP_200=X, **ERROS_AUTENTICADA)`.
ERROS_AUTENTICADA = {'HTTP_401': Erro, 'HTTP_422': Erro}
#: Mais o 403 de `permission_required` e `moderator_or_admin_required` (decorators.py).
ERROS_COM_PERMISSAO = {**ERROS_AUTENTICADA, 'HTTP_403': Erro}


def registrar_documentacao(app, em_producao: bool, spec: SpecTree = contrato) -> None:
    """Documento e páginas do OpenAPI, só fora de produção.

    `/api/openapi.json` (e `/api/docs/openapi.json`), `/api/docs` (vai para o
    Swagger em `/api/docs/swagger/`) e `/api/docs/redoc/`. Em produção o SpecTree
    segue validando; só não publica nada.
    """
    if em_producao:
        return
    spec.register(app)
    # Endpoints com prefixo `openapi`: o SpecTree não os põe no próprio documento.
    app.add_url_rule('/api/openapi.json', endpoint='openapi_documento', view_func=lambda: jsonify(spec.spec))
    app.add_url_rule('/api/docs', endpoint='openapi_inicio', view_func=lambda: redirect('/api/docs/swagger/'))
