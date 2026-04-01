"""
Blueprint de lista do usuário.
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from repositories import ListaRepository, MidiaRepository
from schemas import AtualizacaoListaSchema, ListaMidiaSchema, ValidationError

lista_bp = Blueprint('lista', __name__)

lista_repository = ListaRepository()
midia_repository = MidiaRepository()
lista_schema = ListaMidiaSchema()
atualizacao_schema = AtualizacaoListaSchema()


def _normalizar_payload_lista(data: dict) -> dict:
    payload = dict(data)
    if 'id_anime' in payload and 'id_midia' not in payload:
        payload['id_midia'] = payload['id_anime']
    if 'status_visualizacao' in payload and 'status_consumo' not in payload:
        payload['status_consumo'] = payload['status_visualizacao']
    if 'episodios_assistidos' in payload and 'progresso_atual' not in payload:
        payload['progresso_atual'] = payload['episodios_assistidos']
    if 'status_consumo' in payload and 'status' not in payload:
        payload['status'] = payload['status_consumo']
    if 'data_fim' in payload and 'data_conclusao' not in payload:
        payload['data_conclusao'] = payload['data_fim']
    if 'notas_pessoais' in payload and 'comentario' not in payload:
        payload['comentario'] = payload['notas_pessoais']
    return payload


@lista_bp.route('', methods=['GET'])
@jwt_required()
def obter_lista_usuario():
    """Obter lista do usuário autenticado, com filtro por tipo."""
    try:
        user_id = get_jwt_identity()
        tipo = request.args.get('tipo')
        status = request.args.get('status') or request.args.get('status_consumo')
        lista = lista_repository.obter_lista_usuario(user_id, tipo=tipo, status=status)
        return jsonify({'lista': lista or []}), 200
    except Exception as exc:
        print(f"Erro ao obter lista: {exc}")
        return jsonify({'erro': 'Erro ao buscar lista'}), 500


@lista_bp.route('/<string:target_user_id>', methods=['GET'])
@jwt_required()
def obter_lista_usuario_por_id(target_user_id):
    """Obter lista de um usuário específico."""
    user_id = get_jwt_identity()
    if target_user_id != user_id:
        return jsonify({'erro': 'Sem permissão para acessar esta lista'}), 403
    return obter_lista_usuario()


@lista_bp.route('/adicionar', methods=['POST'])
@jwt_required()
def adicionar_midia_lista():
    """Adicionar mídia à lista do usuário."""
    try:
        user_id = get_jwt_identity()
        payload = _normalizar_payload_lista(request.get_json() or {})
        payload = lista_schema.load(payload)
        id_midia = payload['id_midia']
        status = payload['status']

        if not midia_repository.buscar_por_id(id_midia):
            return jsonify({'erro': 'Mídia não encontrada'}), 404

        result = lista_repository.adicionar_midia(user_id, id_midia, status)
        if result and 'mensagem' in result[0]:
            mensagem = result[0]['mensagem']
            if 'já está na lista' in mensagem:
                return jsonify({'erro': mensagem}), 400

            item = lista_repository.obter_item_usuario(user_id, id_midia)
            if item:
                if 'progresso_atual' in payload and payload['progresso_atual'] not in (None, 0):
                    lista_repository.atualizar_progresso(item['id_lista'], int(payload['progresso_atual']), status)

                update_payload = {}
                if 'nota_usuario' in payload:
                    update_payload['nota_usuario'] = payload['nota_usuario']
                if 'favorito' in payload:
                    update_payload['favorito'] = payload['favorito']
                if 'comentario' in payload:
                    update_payload['comentario'] = payload['comentario']
                if 'data_inicio' in payload:
                    update_payload['data_inicio'] = payload['data_inicio']
                if 'data_conclusao' in payload:
                    update_payload['data_conclusao'] = payload['data_conclusao']
                if 'progresso_total' in payload:
                    update_payload['progresso_total'] = payload['progresso_total']
                if 'total_rewatches' in payload:
                    update_payload['total_rewatches'] = payload['total_rewatches']
                if 'privado' in payload:
                    update_payload['privado'] = payload['privado']

                if update_payload:
                    lista_repository.atualizar_item(item['id_lista'], update_payload)

            return jsonify({'mensagem': mensagem}), 201

        return jsonify({'mensagem': 'Mídia adicionada à lista!'}), 201
    except ValidationError as exc:
        return jsonify({'erro': 'Payload inválido', 'detalhes': exc.errors}), 400
    except Exception as exc:
        print(f"Erro ao adicionar à lista: {exc}")
        return jsonify({'erro': f'Erro ao adicionar mídia: {exc}'}), 500


@lista_bp.route('', methods=['POST'])
@jwt_required()
def adicionar_midia_lista_v2():
    """Adicionar mídia à lista sem usar /adicionar."""
    return adicionar_midia_lista()


@lista_bp.route('/<string:lista_id>/progresso', methods=['PUT'])
@jwt_required()
def atualizar_progresso(lista_id):
    """Atualizar progresso de consumo."""
    try:
        user_id = get_jwt_identity()
        owner = lista_repository.obter_owner(lista_id)
        if owner != user_id:
            return jsonify({'erro': 'Item não encontrado ou sem permissão'}), 403

        payload = _normalizar_payload_lista(request.get_json() or {})
        payload = atualizacao_schema.load(payload, partial=True)

        if 'progresso_atual' not in payload:
            return jsonify({'erro': 'Progresso é obrigatório'}), 400

        status = payload.get('status') or payload.get('status_consumo') or 'planejado'
        lista_repository.atualizar_progresso(lista_id, int(payload['progresso_atual']), status)
        return jsonify({'mensagem': 'Progresso atualizado com sucesso!'}), 200
    except ValidationError as exc:
        return jsonify({'erro': 'Payload inválido', 'detalhes': exc.errors}), 400
    except Exception as exc:
        print(f"Erro ao atualizar progresso: {exc}")
        return jsonify({'erro': f'Erro ao atualizar: {exc}'}), 500


@lista_bp.route('/<string:lista_id>', methods=['PUT'])
@jwt_required()
def atualizar_item_lista(lista_id):
    """Atualizar item da lista."""
    try:
        user_id = get_jwt_identity()
        owner = lista_repository.obter_owner(lista_id)
        if owner != user_id:
            return jsonify({'erro': 'Item não encontrado ou sem permissão'}), 403

        payload = _normalizar_payload_lista(request.get_json() or {})
        payload = atualizacao_schema.load(payload, partial=True)

        if 'progresso_atual' in payload:
            status = payload.get('status') or payload.get('status_consumo') or 'planejado'
            lista_repository.atualizar_progresso(lista_id, int(payload['progresso_atual']), status)

        update_payload = {}
        if 'status' in payload:
            update_payload['status_consumo'] = payload['status']
        if 'status_consumo' in payload:
            update_payload['status_consumo'] = payload['status_consumo']
        if 'nota_usuario' in payload:
            update_payload['nota_usuario'] = payload['nota_usuario']
        if 'favorito' in payload:
            update_payload['favorito'] = payload['favorito']
        if 'comentario' in payload:
            update_payload['comentario'] = payload['comentario']
        if 'data_inicio' in payload:
            update_payload['data_inicio'] = payload['data_inicio']
        if 'data_conclusao' in payload:
            update_payload['data_conclusao'] = payload['data_conclusao']
        if 'total_rewatches' in payload:
            update_payload['total_rewatches'] = payload['total_rewatches']
        if 'privado' in payload:
            update_payload['privado'] = payload['privado']
        if 'progresso_total' in payload:
            update_payload['progresso_total'] = payload['progresso_total']

        if update_payload:
            lista_repository.atualizar_item(lista_id, update_payload)

        return jsonify({'mensagem': 'Lista atualizada com sucesso!'}), 200
    except ValidationError as exc:
        return jsonify({'erro': 'Payload inválido', 'detalhes': exc.errors}), 400
    except Exception as exc:
        print(f"Erro ao atualizar lista: {exc}")
        return jsonify({'erro': f'Erro ao atualizar: {exc}'}), 500


@lista_bp.route('/<string:lista_id>', methods=['DELETE'])
@jwt_required()
def remover_item_lista(lista_id):
    """Remover item da lista."""
    try:
        user_id = get_jwt_identity()
        lista_repository.remover_item(lista_id, user_id)
        return jsonify({'mensagem': 'Mídia removida da lista'}), 200
    except Exception as exc:
        print(f"Erro ao remover da lista: {exc}")
        return jsonify({'erro': 'Erro ao remover mídia'}), 500
