"""
Blueprint de usuário.
"""
from flask import Blueprint, jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required

from banco import consultar, consultar_um
from decorators import get_user_permissions

usuario_bp = Blueprint('usuario', __name__)

#: Antes era a procedure `obter_estatisticas_usuario`; agora é consulta da
#: aplicação (ADR-0007). Concluídos e Em progresso pelos Rótulos de cada Tipo.
ESTATISTICAS_POR_TIPO = """
    SELECT
        tm.nome_tipo AS tipo,
        tm.label AS label,
        count(DISTINCT lu.id_midia) AS total_midias,
        count(*) FILTER (WHERE lu.status_consumo IN ('completo', 'lido', 'zerado', 'platinado')) AS concluidos,
        count(*) FILTER (WHERE lu.status_consumo IN ('assistindo', 'lendo', 'jogando')) AS em_andamento,
        COALESCE(sum(lu.progresso_atual), 0) AS progresso_total_consumido,
        round(avg(lu.nota_usuario), 2) AS nota_media,
        count(DISTINCT lu.id_midia) FILTER (WHERE lu.favorito) AS favoritos
    FROM lista_usuarios lu
    JOIN midias m ON m.id_midia = lu.id_midia
    JOIN tipo_midia tm ON tm.id_tipo = m.id_tipo
    WHERE lu.id_usuario = %s
    GROUP BY tm.id_tipo, tm.nome_tipo, tm.label
    ORDER BY tm.id_tipo
"""


@usuario_bp.route('/perfil', methods=['GET'])
@jwt_required()
def obter_perfil():
    """Obter perfil completo do usuário."""
    perfil = consultar_um("SELECT * FROM vw_perfil_usuario WHERE id_usuario = %s", (get_jwt_identity(),))
    if not perfil:
        return jsonify({'erro': 'Perfil não encontrado'}), 404
    return jsonify({'perfil': perfil}), 200


@usuario_bp.route('/permissoes', methods=['GET'])
@jwt_required()
def obter_permissoes():
    """Obter permissões do usuário."""
    return jsonify({'permissoes': get_user_permissions(get_jwt_identity())}), 200


@usuario_bp.route('/estatisticas', methods=['GET'])
@jwt_required()
def obter_estatisticas():
    """Obter estatísticas do usuário por tipo de mídia."""
    result = consultar(ESTATISTICAS_POR_TIPO, (get_jwt_identity(),))

    resumo = {
        'total_midias': sum(item.get('total_midias') or 0 for item in result),
        'concluidos': sum(item.get('concluidos') or 0 for item in result),
        'em_andamento': sum(item.get('em_andamento') or 0 for item in result),
        'favoritos': sum(item.get('favoritos') or 0 for item in result),
    }
    return jsonify({'estatisticas': result, 'resumo': resumo}), 200
