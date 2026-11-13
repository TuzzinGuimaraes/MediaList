"""
Blueprint de moderação.
"""
from flask import Blueprint, jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required

import decorators
from database import execute_query
from decorators import moderator_or_admin_required

moderacao_bp = Blueprint('moderacao', __name__)

# Nível de acesso (CONTEXT.md): usuario < moderador < admin.
ORDEM_NIVEL = {'usuario': 1, 'moderador': 2, 'admin': 3}


def _nivel(user_id):
    """Nível efetivo: o mais alto entre os Grupos do usuário."""
    nivel = decorators.get_user_permissions(user_id).get('nivel_acesso')
    return ORDEM_NIVEL.get(nivel, 1)


def _alterar_status(target_user_id, ativo):
    """Ativa/desativa respeitando a hierarquia: ninguém altera a si mesmo e só
    se age sobre quem tem Nível estritamente menor (admin só cai por admin)."""
    ator = get_jwt_identity()
    if target_user_id == ator:
        return jsonify({'erro': 'Você não pode alterar o próprio status'}), 403

    alvo = execute_query("SELECT id_usuario FROM usuarios WHERE id_usuario = %s", (target_user_id,))
    if alvo is None:
        return jsonify({'erro': 'Erro ao consultar usuário'}), 500
    if not alvo:
        return jsonify({'erro': 'Usuário não encontrado'}), 404

    if _nivel(target_user_id) >= _nivel(ator):
        return jsonify({'erro': 'Só é possível moderar usuários com nível de acesso menor que o seu'}), 403

    query = (
        "UPDATE usuarios SET ativo = TRUE WHERE id_usuario = %s" if ativo
        else "UPDATE usuarios SET ativo = FALSE WHERE id_usuario = %s"
    )
    if execute_query(query, (target_user_id,), fetch=False) is None:
        return jsonify({'erro': 'Erro ao atualizar usuário'}), 500

    mensagem = 'Usuário ativado com sucesso' if ativo else 'Usuário desativado com sucesso'
    return jsonify({'mensagem': mensagem}), 200


@moderacao_bp.route('/avaliacoes', methods=['GET'])
@jwt_required()
@moderator_or_admin_required
def listar_avaliacoes_moderacao():
    """Listar avaliações para moderação."""
    try:
        query = """
            SELECT
                av.*,
                u.nome_completo,
                m.titulo_portugues,
                m.titulo_original,
                tm.nome_tipo AS tipo
            FROM avaliacoes av
            JOIN usuarios u ON av.id_usuario = u.id_usuario
            JOIN midias m ON av.id_midia = m.id_midia
            JOIN tipo_midia tm ON m.id_tipo = tm.id_tipo
            ORDER BY av.data_avaliacao DESC
            LIMIT 50
        """
        avaliacoes = execute_query(query)
        return jsonify({'avaliacoes': avaliacoes or []}), 200
    except Exception as exc:
        print(f"Erro ao listar avaliações: {exc}")
        return jsonify({'erro': 'Erro ao buscar avaliações'}), 500


@moderacao_bp.route('/usuarios', methods=['GET'])
@jwt_required()
@moderator_or_admin_required
def listar_usuarios_moderacao():
    """Listar usuários para moderação."""
    try:
        query = """
            SELECT
                u.id_usuario,
                u.nome_completo,
                u.email,
                u.data_cadastro,
                u.ultimo_acesso,
                u.ativo,
                GROUP_CONCAT(DISTINCT gu.nome_grupo SEPARATOR ', ') AS grupos,
                COUNT(DISTINCT lu.id_midia) AS total_midias,
                COUNT(DISTINCT CASE WHEN tm.nome_tipo = 'anime' THEN lu.id_midia END) AS total_animes,
                COUNT(DISTINCT av.id_avaliacao) AS total_avaliacoes
            FROM usuarios u
            LEFT JOIN usuarios_grupos ug ON u.id_usuario = ug.id_usuario
            LEFT JOIN grupos_usuarios gu ON ug.id_grupo = gu.id_grupo
            LEFT JOIN lista_usuarios lu ON u.id_usuario = lu.id_usuario
            LEFT JOIN midias m ON lu.id_midia = m.id_midia
            LEFT JOIN tipo_midia tm ON m.id_tipo = tm.id_tipo
            LEFT JOIN avaliacoes av ON u.id_usuario = av.id_usuario
            GROUP BY u.id_usuario
            ORDER BY u.data_cadastro DESC
            LIMIT 100
        """
        usuarios = execute_query(query)
        return jsonify({'usuarios': usuarios or []}), 200
    except Exception as exc:
        print(f"Erro ao listar usuários: {exc}")
        return jsonify({'erro': 'Erro ao buscar usuários'}), 500


@moderacao_bp.route('/usuarios/<string:target_user_id>/desativar', methods=['PUT'])
@jwt_required()
@moderator_or_admin_required
def desativar_usuario(target_user_id):
    """Desativar usuário."""
    try:
        return _alterar_status(target_user_id, ativo=False)
    except Exception as exc:
        print(f"Erro ao desativar usuário: {exc}")
        return jsonify({'erro': 'Erro ao desativar usuário'}), 500


@moderacao_bp.route('/usuarios/<string:target_user_id>/ativar', methods=['PUT'])
@jwt_required()
@moderator_or_admin_required
def ativar_usuario(target_user_id):
    """Ativar usuário."""
    try:
        return _alterar_status(target_user_id, ativo=True)
    except Exception as exc:
        print(f"Erro ao ativar usuário: {exc}")
        return jsonify({'erro': 'Erro ao ativar usuário'}), 500
