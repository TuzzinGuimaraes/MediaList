"""
Blueprint de Notícias.

`autor` sai como o nome do Usuário que publicou (`noticias.id_autor`); Notícia
de Usuário apagado sai com 'Admin', o autor padrão de antes.
"""
from flask import Blueprint
from flask_jwt_extended import get_jwt_identity, jwt_required
from spectree import Response

from banco import consultar, consultar_um
from contrato import AUTENTICADO, Pagina, contrato, montar_pagina
from decorators import permission_required
from schemas.noticias import ConsultaNoticias, CorpoNoticia, Noticia, NoticiaCriada

noticias_bp = Blueprint('noticias', __name__)


@noticias_bp.route('', methods=['GET'])
@contrato.validate(resp=Response(HTTP_200=Pagina[Noticia]), tags=['noticias'])
def listar_noticias(query: ConsultaNoticias):
    """Uma página das Notícias, mais recentes primeiro."""
    noticias = consultar(
        """
        SELECT n.id_noticia, n.titulo, n.conteudo, COALESCE(u.nome_completo, 'Admin') AS autor,
               n.categoria, n.tags, n.imagem_url, n.data_publicacao
        FROM noticias n
        LEFT JOIN usuarios u ON u.id_usuario = n.id_autor
        ORDER BY n.data_publicacao DESC, n.id_noticia DESC
        LIMIT %s OFFSET %s
        """,
        (query.por_pagina, (query.pagina - 1) * query.por_pagina),
    )
    total = consultar_um('SELECT count(*) AS total FROM noticias')['total']
    return montar_pagina(noticias, total, query.pagina, query.por_pagina)


@noticias_bp.route('', methods=['POST'])
@jwt_required()
@permission_required('criar')
@contrato.validate(resp=Response(HTTP_201=NoticiaCriada), tags=['noticias'], security=AUTENTICADO)
def criar_noticia(json: CorpoNoticia):
    """Criar Notícia; o autor é o Usuário logado."""
    criada = consultar_um(
        """
        INSERT INTO noticias (titulo, conteudo, id_autor, categoria, tags, imagem_url)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id_noticia
        """,
        (
            json.titulo,
            json.conteudo or '',
            get_jwt_identity(),
            json.categoria or 'geral',
            json.tags or [],
            json.imagem_url or None,
        ),
    )
    return {'mensagem': 'Notícia criada!', 'id': criada['id_noticia']}, 201
