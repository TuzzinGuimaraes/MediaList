"""
Blueprint de avaliações.

A escala da nota (0 a 10, uma casa) é garantida pelo CHECK do banco: fora dela,
a gravação levanta `Integridade` e a resposta é 400. A validação no domínio é
do ticket 13.
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from banco import consultar_um, executar, transacao
from decorators import get_user_permissions
from repositories import MidiaRepository

avaliacoes_bp = Blueprint('avaliacoes', __name__)

midia_repository = MidiaRepository()

NOTAS_DA_MIDIA = "SELECT nota_media, total_avaliacoes FROM vw_notas_midia WHERE id_midia = %s"


@avaliacoes_bp.route('/<string:id_midia>', methods=['GET'])
def listar_avaliacoes(id_midia):
    """Listar avaliações de uma mídia."""
    if not midia_repository.buscar_por_id(id_midia):
        return jsonify({'erro': 'Mídia não encontrada'}), 404
    return jsonify({'avaliacoes': midia_repository.obter_avaliacoes(id_midia)}), 200


@avaliacoes_bp.route('', methods=['POST'])
@jwt_required()
def criar_avaliacao():
    """Criar avaliação."""
    user_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}
    id_midia = data.get('id_midia') or data.get('id_anime')

    # Nota 0 é nota: só ausência é recusada aqui.
    if not id_midia or data.get('nota') is None or isinstance(data.get('nota'), bool):
        return jsonify({'erro': 'ID da mídia e nota são obrigatórios'}), 400

    if not midia_repository.buscar_por_id(id_midia):
        return jsonify({'erro': 'Mídia não encontrada'}), 404

    if consultar_um(
        "SELECT id_avaliacao FROM avaliacoes WHERE id_usuario = %s AND id_midia = %s",
        (user_id, id_midia),
    ):
        return jsonify({'erro': 'Você já avaliou esta mídia'}), 400

    # Uma corrida entre a checagem e o INSERT esbarra na unique key: Conflito, 409.
    with transacao() as t:
        avaliacao = t.consultar_um(
            """
            INSERT INTO avaliacoes (id_usuario, id_midia, nota, titulo_avaliacao, texto_avaliacao)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id_avaliacao
            """,
            (user_id, id_midia, data['nota'], data.get('titulo_avaliacao'), data.get('texto_avaliacao')),
        )
        notas = t.consultar_um(NOTAS_DA_MIDIA, (id_midia,)) or {}

    return jsonify({
        'mensagem': 'Avaliação criada com sucesso!',
        'id_avaliacao': avaliacao['id_avaliacao'],
        'nota_media_atualizada': notas.get('nota_media'),
        'total_avaliacoes': notas.get('total_avaliacoes'),
    }), 201


@avaliacoes_bp.route('/<string:avaliacao_id>', methods=['PUT'])
@jwt_required()
def editar_avaliacao(avaliacao_id):
    """Editar avaliação."""
    user_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({'erro': 'Dados não fornecidos'}), 400

    atual = consultar_um("SELECT id_usuario, id_midia FROM avaliacoes WHERE id_avaliacao = %s", (avaliacao_id,))
    if not atual or atual['id_usuario'] != user_id:
        return jsonify({'erro': 'Avaliação não encontrada ou sem permissão'}), 403

    fields = []
    params = []
    for campo in ('nota', 'titulo_avaliacao', 'texto_avaliacao'):
        if campo in data:
            fields.append(f"{campo} = %s")
            params.append(data[campo])

    if not fields:
        return jsonify({'erro': 'Nenhum campo para atualizar'}), 400

    fields.append("data_edicao = now()")
    with transacao() as t:
        t.executar(
            f"UPDATE avaliacoes SET {', '.join(fields)} WHERE id_avaliacao = %s",
            (*params, avaliacao_id),
        )
        notas = t.consultar_um(NOTAS_DA_MIDIA, (atual['id_midia'],)) or {}

    return jsonify({
        'mensagem': 'Avaliação atualizada com sucesso!',
        'nota_media_atualizada': notas.get('nota_media'),
    }), 200


@avaliacoes_bp.route('/<string:avaliacao_id>', methods=['DELETE'])
@jwt_required()
def deletar_avaliacao(avaliacao_id):
    """Deletar avaliação."""
    user_id = get_jwt_identity()
    permissions = get_user_permissions(user_id)

    atual = consultar_um("SELECT id_usuario FROM avaliacoes WHERE id_avaliacao = %s", (avaliacao_id,))
    if not atual:
        return jsonify({'erro': 'Avaliação não encontrada'}), 404

    if atual['id_usuario'] != user_id and not permissions['pode_moderar']:
        return jsonify({'erro': 'Sem permissão para deletar esta avaliação'}), 403

    executar("DELETE FROM avaliacoes WHERE id_avaliacao = %s", (avaliacao_id,))
    return jsonify({'mensagem': 'Avaliação removida com sucesso'}), 200
