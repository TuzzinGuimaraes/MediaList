"""
Blueprint de Notícias.

`autor` sai como o nome do Usuário que publicou (`noticias.id_autor`); Notícia
de Usuário apagado sai com 'Admin', o autor padrão de antes. Publicar uma Notícia
grava, na mesma transação, a Notificação de cada Usuário ativo menos o autor, e
depois avisa por push os aparelhos de quem quer ser avisado (`avisos_push`), antes de
responder: na Vercel o que roda depois da resposta pode ser congelado.

Editar e excluir (Q130) são do admin, sobre qualquer Notícia. Editar troca o conteúdo e grava
`data_edicao`, sem Notificação nem push; excluir apaga de vez, e as Notificações vão junto
(cascade da migração 0012).
"""
from flask import Blueprint
from flask_jwt_extended import get_jwt_identity, jwt_required
from spectree import Response

import avisos_push
from banco import consultar, consultar_um, transacao
from contrato import (
    AUTENTICADO,
    ERROS_AUTENTICADA,
    CodigoErro,
    ConsultaPaginada,
    Erro,
    Mensagem,
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
           n.categoria, n.tags, n.imagem_url, n.data_publicacao, n.data_edicao
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


def _campos_opcionais(json: CorpoNoticia):
    """categoria, tags e imagem_url com os padrões de quando faltam."""
    return json.categoria or 'geral', json.tags or [], json.imagem_url or None


@noticias_bp.route('', methods=['POST'])
@jwt_required()
@admin_required
@contrato.validate(
    resp=Response(HTTP_201=NoticiaCriada, **ERROS_AUTENTICADA), tags=['noticias'], security=AUTENTICADO,
)
def criar_noticia(json: CorpoNoticia):
    """Criar Notícia; o autor é o Usuário logado. Cada Usuário ativo, menos o autor, ganha a Notificação
    e, se tiver "Avisar sobre Notícias", o push."""
    id_autor = get_jwt_identity()
    with transacao() as t:
        criada = t.consultar_um(
            """
            INSERT INTO noticias (titulo, conteudo, id_autor, categoria, tags, imagem_url)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id_noticia
            """,
            (json.titulo, json.conteudo or '', id_autor, *_campos_opcionais(json)),
        )
        t.executar(
            """
            INSERT INTO notificacoes (id_usuario, id_noticia)
            SELECT id_usuario, %s FROM usuarios WHERE ativo AND id_usuario <> %s
            """,
            (criada['id_noticia'], id_autor),
        )
    # A Notícia já está gravada: o push tem prazo curto e nunca levanta.
    avisos_push.avisar_noticia(criada['id_noticia'], json.titulo, json.conteudo or '', id_autor)
    return {'mensagem': 'Notícia criada!', 'id_noticia': criada['id_noticia']}, 201


@noticias_bp.route('/<string:id_noticia>', methods=['PUT'])
@jwt_required()
@admin_required
@contrato.validate(
    resp=Response(HTTP_200=Mensagem, HTTP_404=Erro, **ERROS_AUTENTICADA), tags=['noticias'], security=AUTENTICADO,
)
def editar_noticia(id_noticia, json: CorpoNoticia):
    """Editar Notícia (só admin, qualquer uma): troca título, conteúdo, categoria, tags e imagem e grava
    `data_edicao`. O autor fica; não gera Notificação nem push."""
    editada = consultar_um(
        """
        UPDATE noticias
        SET titulo = %s, conteudo = %s, categoria = %s, tags = %s, imagem_url = %s, data_edicao = now()
        WHERE id_noticia = %s
        RETURNING id_noticia
        """,
        (json.titulo, json.conteudo or '', *_campos_opcionais(json), id_noticia),
    )
    if not editada:
        return resposta_erro(404, CodigoErro.NAO_ENCONTRADO, 'Notícia não encontrada')
    return {'mensagem': 'Notícia atualizada!'}


@noticias_bp.route('/<string:id_noticia>', methods=['DELETE'])
@jwt_required()
@admin_required
@contrato.validate(
    resp=Response(HTTP_200=Mensagem, HTTP_404=Erro, **ERROS_AUTENTICADA), tags=['noticias'], security=AUTENTICADO,
)
def excluir_noticia(id_noticia):
    """Excluir Notícia (só admin, qualquer uma), de vez: as Notificações dela somem de todos."""
    excluida = consultar_um('DELETE FROM noticias WHERE id_noticia = %s RETURNING id_noticia', (id_noticia,))
    if not excluida:
        return resposta_erro(404, CodigoErro.NAO_ENCONTRADO, 'Notícia não encontrada')
    return {'mensagem': 'Notícia excluída!'}
