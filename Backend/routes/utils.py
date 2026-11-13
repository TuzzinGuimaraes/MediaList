"""
Blueprint de utilidades.
"""
import logging

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from banco import consultar, consultar_um, executar
from repositories.midia_repository import origem_nota

logger = logging.getLogger(__name__)

utils_bp = Blueprint('utils', __name__)


@utils_bp.route('/generos', methods=['GET'])
def listar_generos():
    """Listar gêneros, opcionalmente filtrando por tipo.

    `aplicavel_a` é text[] e sai como lista no JSON. O filtro casa o elemento
    inteiro (índice GIN): '?tipo=nim' não casa com 'anime'.
    """
    tipo = request.args.get('tipo')
    if tipo:
        generos = consultar(
            "SELECT * FROM generos WHERE aplicavel_a @> ARRAY[%s]::text[] ORDER BY nome_genero",
            (tipo,),
        )
    else:
        generos = consultar("SELECT * FROM generos ORDER BY nome_genero")
    return jsonify({'generos': generos}), 200


@utils_bp.route('/notificacoes', methods=['GET'])
@jwt_required()
def obter_notificacoes():
    """As 50 Notificações mais recentes do Usuário; `?nao_lidas=true` só as não lidas.

    Título, tipo e Mídia vêm da Atualização de mídia que a Notificação entrega.
    `anime_nome` repete `midia_nome` para o web antigo.
    """
    apenas_nao_lidas = request.args.get('nao_lidas', 'false').lower() == 'true'
    notificacoes = consultar(
        """
        SELECT n.id_usuario, a.id_midia, t.nome_tipo AS tipo_midia,
               a.tipo_atualizacao AS tipo, a.titulo,
               COALESCE(NULLIF(m.titulo_portugues, ''), m.titulo_original) AS midia_nome,
               COALESCE(NULLIF(m.titulo_portugues, ''), m.titulo_original) AS anime_nome,
               'Novidade em ' || t.nome_tipo || ' da sua lista: '
                   || COALESCE(NULLIF(m.titulo_portugues, ''), m.titulo_original) AS mensagem,
               n.lida, n.data_criacao
        FROM notificacoes n
        JOIN atualizacoes_midia a ON a.id_atualizacao = n.id_atualizacao
        JOIN midias m ON m.id_midia = a.id_midia
        JOIN tipo_midia t ON t.id_tipo = m.id_tipo
        WHERE n.id_usuario = %s AND (NOT %s OR NOT n.lida)
        ORDER BY n.data_criacao DESC, n.id_notificacao DESC
        LIMIT 50
        """,
        (get_jwt_identity(), apenas_nao_lidas),
    )
    return jsonify({'notificacoes': notificacoes}), 200


@utils_bp.route('/notificacoes/marcar-todas-lidas', methods=['PUT'])
@jwt_required()
def marcar_todas_lidas():
    """Marcar como lidas todas as Notificações do Usuário."""
    marcadas = executar(
        'UPDATE notificacoes SET lida = true WHERE id_usuario = %s AND NOT lida',
        (get_jwt_identity(),),
    )
    return jsonify({'mensagem': f'{marcadas} notificações marcadas como lidas'}), 200


@utils_bp.route('/health', methods=['GET'])
def health_check():
    """Saúde do sistema: 200 com o PostgreSQL de pé, 503 sem ele."""
    try:
        postgres_ok = consultar_um('SELECT 1 AS ok') == {'ok': 1}
    except Exception:
        logger.warning('Health: PostgreSQL inacessível', exc_info=True)
        postgres_ok = False

    if not postgres_ok:
        return jsonify({'status': 'unhealthy', 'postgres': 'disconnected'}), 503
    return jsonify({'status': 'healthy', 'postgres': 'connected'}), 200


#: Popularidade primeiro; a nota (Nota média, senão a da fonte) desempata.
POPULARES = f"""
    SELECT p.*, {origem_nota('p.nota_fonte')} AS origem_nota
    FROM vw_midias_populares p
    LEFT JOIN animes a ON a.id_midia = p.id_midia
    LEFT JOIN mangas ma ON ma.id_midia = p.id_midia
    LEFT JOIN jogos j ON j.id_midia = p.id_midia
    WHERE %(tipo)s::text IS NULL OR p.tipo = %(tipo)s
    ORDER BY p.total_usuarios DESC, COALESCE(p.nota_media, p.nota_fonte) DESC NULLS LAST, p.id_midia
    LIMIT 20
"""


@utils_bp.route('/midias/populares', methods=['GET'])
def midias_populares():
    """Mídias mais populares."""
    midias = consultar(POPULARES, {'tipo': request.args.get('tipo') or None})
    return jsonify({'midias': midias}), 200


@utils_bp.route('/animes/populares', methods=['GET'])
def animes_populares():
    """Compatibilidade para populares de animes."""
    animes = consultar(POPULARES, {'tipo': 'anime'})
    return jsonify({'animes': animes}), 200


@utils_bp.route('/animes/temporada', methods=['GET'])
def animes_temporada():
    """Animes da temporada atual."""
    return jsonify({'animes': consultar("SELECT * FROM vw_animes_temporada_atual")}), 200
