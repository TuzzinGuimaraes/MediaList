"""
Blueprint de Notícias.

`autor` sai como o nome do Usuário que publicou (`noticias.id_autor`); Notícia
de Usuário apagado sai com 'Admin', o autor padrão de antes.
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from banco import consultar, consultar_um
from decorators import permission_required
from parametros import POR_PAGINA_MAX, ler_int

noticias_bp = Blueprint('noticias', __name__)


@noticias_bp.route('', methods=['GET'])
def listar_noticias():
    """As Notícias mais recentes."""
    limite = ler_int('limite', 10, minimo=1, maximo=POR_PAGINA_MAX)
    noticias = consultar(
        """
        SELECT n.titulo, n.conteudo, COALESCE(u.nome_completo, 'Admin') AS autor,
               n.categoria, n.tags, n.imagem_url, n.data_publicacao, n.visualizacoes
        FROM noticias n
        LEFT JOIN usuarios u ON u.id_usuario = n.id_autor
        ORDER BY n.data_publicacao DESC
        LIMIT %s
        """,
        (limite,),
    )
    return jsonify({'noticias': noticias}), 200


@noticias_bp.route('', methods=['POST'])
@jwt_required()
@permission_required('criar')
def criar_noticia():
    """Criar Notícia; o autor é o Usuário logado."""
    data = request.get_json(silent=True) or {}
    if not data.get('titulo'):
        return jsonify({'erro': 'Título é obrigatório'}), 400

    tags = data.get('tags') or []
    if not isinstance(tags, list) or not all(isinstance(tag, str) for tag in tags):
        return jsonify({'erro': 'Tags devem ser uma lista de textos'}), 400

    criada = consultar_um(
        """
        INSERT INTO noticias (titulo, conteudo, id_autor, categoria, tags, imagem_url)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id_noticia
        """,
        (
            data['titulo'],
            data.get('conteudo') or '',
            get_jwt_identity(),
            data.get('categoria') or 'geral',
            tags,
            data.get('imagem_url') or None,
        ),
    )
    return jsonify({'mensagem': 'Notícia criada!', 'id': criada['id_noticia']}), 201
