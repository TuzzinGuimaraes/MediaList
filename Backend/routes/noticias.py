"""
Blueprint de Notícias.

`autor` sai como o nome do Usuário que publicou (`noticias.id_autor`); Notícia
de Usuário apagado sai com 'Admin', o autor padrão de antes. Publicar uma Notícia
grava, na mesma transação, a Notificação de cada Usuário ativo menos o autor.
"""
from flask import Blueprint
from flask_jwt_extended import get_jwt_identity, jwt_required
from spectree import Response

from banco import consultar, consultar_um, transacao
from contrato import (
    AUTENTICADO,
    ERROS_AUTENTICADA,
    CodigoErro,
    ConsultaPaginada,
    Erro,
    Pagina,
    contrato,
    deslocamento,
    montar_pagina,
    resposta_erro,
)
from decorators import admin_required
from schemas.noticias import CorpoNoticia, Noticia, NoticiaCriada

noticias_bp = Blueprint('noticias', __name__)

SELECT_NOTICIA = """
    SELECT n.id_noticia, n.titulo, n.conteudo, COALESCE(u.nome_completo, 'Admin') AS autor,
           n.categoria, n.tags, n.imagem_url, n.data_publicacao
    FROM noticias n
    LEFT JOIN usuarios u ON u.id_usuario = n.id_autor
"""


@noticias_bp.route('', methods=['GET'])
@contrato.validate(resp=Response(HTTP_200=Pagina[Noticia]), tags=['noticias'])
def listar_noticias(query: ConsultaPaginada):
    """Uma página das Notícias, mais recentes primeiro."""
    noticias = consultar(
        f"""
        {SELECT_NOTICIA}
        ORDER BY n.data_publicacao DESC, n.id_noticia DESC
        LIMIT %s OFFSET %s
        """,
        (query.por_pagina, deslocamento(query)),
    )
    total = consultar_um('SELECT count(*) AS total FROM noticias')['total']
    return montar_pagina(noticias, total, query.pagina, query.por_pagina)


@noticias_bp.route('/<string:id_noticia>', methods=['GET'])
@contrato.validate(resp=Response(HTTP_200=Noticia, HTTP_404=Erro), tags=['noticias'])
def obter_noticia(id_noticia):
    """Uma Notícia, para o link da Notificação."""
    noticia = consultar_um(f'{SELECT_NOTICIA} WHERE n.id_noticia = %s', (id_noticia,))
    if not noticia:
        return resposta_erro(404, CodigoErro.NAO_ENCONTRADO, 'Notícia não encontrada')
    return noticia


@noticias_bp.route('', methods=['POST'])
@jwt_required()
@admin_required
@contrato.validate(
    resp=Response(HTTP_201=NoticiaCriada, **ERROS_AUTENTICADA), tags=['noticias'], security=AUTENTICADO,
)
def criar_noticia(json: CorpoNoticia):
    """Criar Notícia; o autor é o Usuário logado. Cada Usuário ativo, menos o autor, ganha a Notificação."""
    id_autor = get_jwt_identity()
    with transacao() as t:
        criada = t.consultar_um(
            """
            INSERT INTO noticias (titulo, conteudo, id_autor, categoria, tags, imagem_url)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id_noticia
            """,
            (
                json.titulo,
                json.conteudo or '',
                id_autor,
                json.categoria or 'geral',
                json.tags or [],
                json.imagem_url or None,
            ),
        )
        t.executar(
            """
            INSERT INTO notificacoes (id_usuario, id_noticia)
            SELECT id_usuario, %s FROM usuarios WHERE ativo AND id_usuario <> %s
            """,
            (criada['id_noticia'], id_autor),
        )
    return {'mensagem': 'Notícia criada!', 'id_noticia': criada['id_noticia']}, 201
