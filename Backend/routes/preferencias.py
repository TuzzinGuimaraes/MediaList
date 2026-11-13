"""
Blueprint de Preferências: `usuarios.preferencias` (jsonb).

O jsonb guarda só o que o Usuário mudou; a leitura completa com os padrões.
"""
import json

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from banco import consultar_um, executar

preferencias_bp = Blueprint('preferencias', __name__)

PADROES = {'tema': 'light', 'idioma': 'pt-BR', 'notificacoes_ativas': True}
TIPOS = {'tema': str, 'idioma': str, 'notificacoes_ativas': bool}


@preferencias_bp.route('', methods=['GET'])
@jwt_required()
def obter_preferencias():
    """Preferências do Usuário, com os padrões no que ele não mudou."""
    user_id = get_jwt_identity()
    linha = consultar_um('SELECT preferencias FROM usuarios WHERE id_usuario = %s', (user_id,))
    if linha is None:
        return jsonify({'erro': 'Usuário não encontrado'}), 404

    salvas = {campo: valor for campo, valor in linha['preferencias'].items() if campo in PADROES}
    return jsonify({'preferencias': {'id_usuario': user_id, **PADROES, **salvas}}), 200


@preferencias_bp.route('', methods=['PUT'])
@jwt_required()
def atualizar_preferencias():
    """Grava os campos permitidos; os outros ficam como estão."""
    data = request.get_json(silent=True) or {}
    mudancas = {campo: data[campo] for campo in PADROES if campo in data}
    if not mudancas:
        return jsonify({'erro': 'Nenhuma preferência válida fornecida'}), 400

    errados = [campo for campo, valor in mudancas.items() if not isinstance(valor, TIPOS[campo])]
    if errados:
        return jsonify({'erro': f"Tipo inválido em: {', '.join(errados)}"}), 400

    linhas = executar(
        'UPDATE usuarios SET preferencias = preferencias || %s::jsonb WHERE id_usuario = %s',
        (json.dumps(mudancas), get_jwt_identity()),
    )
    return jsonify({'mensagem': 'Preferências atualizadas com sucesso!', 'modificado': linhas > 0}), 200
