"""
Blueprint de avaliações: adaptador HTTP de `dominio.avaliacao`.

A rota lê o corpo, chama o módulo e traduz o `Resultado` para um código HTTP.
A regra (dono, uma por Mídia, escala da nota) é do módulo. Os testes trocam
`avaliacoes` deste módulo.
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from decorators import get_user_permissions
from dominio.avaliacao import CONFLITO, Avaliacoes
from dominio.lista_pessoal import INVALIDO, NAO_ENCONTRADO, NEGADO
from repositories.avaliacoes import AvaliacaoRepository
from repositories.catalogo import Catalogo

avaliacoes_bp = Blueprint('avaliacoes', __name__)

avaliacoes = Avaliacoes(AvaliacaoRepository(), Catalogo())

STATUS_DO_ERRO = {INVALIDO: 400, NEGADO: 403, NAO_ENCONTRADO: 404, CONFLITO: 409}


def _erro(resultado):
    corpo = {'erro': resultado.erro}
    if resultado.detalhes:
        corpo['detalhes'] = resultado.detalhes
    return jsonify(corpo), STATUS_DO_ERRO[resultado.codigo]


@avaliacoes_bp.route('/<string:id_midia>', methods=['GET'])
def listar_avaliacoes(id_midia):
    """Listar avaliações de uma mídia."""
    resultado = avaliacoes.listar(id_midia)
    if not resultado.bem_sucedido:
        return _erro(resultado)
    return jsonify({'avaliacoes': resultado.dados['avaliacoes']}), 200


@avaliacoes_bp.route('', methods=['POST'])
@jwt_required()
def criar_avaliacao():
    """Criar avaliação."""
    resultado = avaliacoes.criar(get_jwt_identity(), request.get_json(silent=True))
    if not resultado.bem_sucedido:
        return _erro(resultado)
    return jsonify({
        'mensagem': 'Avaliação criada com sucesso!',
        'id_avaliacao': resultado.dados['id_avaliacao'],
        'nota_media_atualizada': resultado.dados['nota_media'],
        'total_avaliacoes': resultado.dados['total_avaliacoes'],
    }), 201


@avaliacoes_bp.route('/<string:avaliacao_id>', methods=['PUT'])
@jwt_required()
def editar_avaliacao(avaliacao_id):
    """Editar avaliação."""
    resultado = avaliacoes.editar(get_jwt_identity(), avaliacao_id, request.get_json(silent=True))
    if not resultado.bem_sucedido:
        return _erro(resultado)
    return jsonify({
        'mensagem': 'Avaliação atualizada com sucesso!',
        'nota_media_atualizada': resultado.dados['nota_media'],
    }), 200


@avaliacoes_bp.route('/<string:avaliacao_id>', methods=['DELETE'])
@jwt_required()
def deletar_avaliacao(avaliacao_id):
    """Deletar avaliação: o autor, ou quem pode moderar."""
    user_id = get_jwt_identity()
    pode_moderar = bool(get_user_permissions(user_id)['pode_moderar'])
    resultado = avaliacoes.apagar(user_id, avaliacao_id, pode_moderar)
    if not resultado.bem_sucedido:
        return _erro(resultado)
    return jsonify({'mensagem': 'Avaliação removida com sucesso'}), 200
