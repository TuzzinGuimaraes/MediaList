"""
Blueprint de lista do usuário: adaptador HTTP de `dominio.lista_pessoal`.

Aqui não há regra de Item de lista. A rota faz três coisas: renomear os aliases
legados do fio para o nome canônico do campo, chamar o módulo e traduzir o
`Resultado` para um código HTTP. Escrever regra aqui é o que deixou a lógica
duplicada em três lugares antes. A única exigência que sobra do lado HTTP é o
que cada endpoint pede do corpo — `/progresso` sem progresso não é chamada —,
que é contrato do endpoint, não do Item.

A leitura é a exceção: `obter_lista_usuario` consulta o repositório direto,
porque não decide nada.
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from dominio.lista_pessoal import INVALIDO, NAO_ENCONTRADO, NEGADO, ListaPessoal
from repositories import ListaRepository, MidiaRepository

lista_bp = Blueprint('lista', __name__)

lista_repository = ListaRepository()
midia_repository = MidiaRepository()
lista_pessoal = ListaPessoal(lista_repository, midia_repository)

#: Nomes antigos que os clientes ainda mandam -> nome canônico do campo. Só o
#: adaptador os conhece: o módulo trabalha com um nome por campo.
#:
#: O nome canônico enviado junto vence o alias, e entre dois aliases do mesmo
#: campo vence o primeiro desta lista — `status` antes de `status_visualizacao`.
ALIASES_LEGADOS = {
    'id_anime': 'id_midia',
    'status': 'status_consumo',
    'status_visualizacao': 'status_consumo',
    'episodios_assistidos': 'progresso_atual',
    'data_fim': 'data_conclusao',
    'notas_pessoais': 'comentario',
}

#: Resposta única para `nao_encontrado` e `negado`: distinguir os dois revelaria
#: quais Itens existem nas listas dos outros usuários.
ERRO_SEM_ACESSO = 'Item não encontrado ou sem permissão'


def _normalizar_payload_lista(data: dict | None) -> dict:
    """Payload com os aliases legados reescritos no nome canônico."""
    data = data if isinstance(data, dict) else {}
    payload = {campo: valor for campo, valor in data.items() if campo not in ALIASES_LEGADOS}

    for alias, canonico in ALIASES_LEGADOS.items():
        if alias in data and canonico not in payload:
            payload[canonico] = data[alias]

    return payload


def _resposta(resultado, mensagem: str, status_ok: int = 200):
    """Traduz o `Resultado` do módulo para (corpo, código HTTP)."""
    if resultado.bem_sucedido:
        corpo = {'mensagem': mensagem}
        if resultado.id_lista:
            corpo['id_lista'] = resultado.id_lista
        return jsonify(corpo), status_ok

    if resultado.codigo == INVALIDO:
        return jsonify({'erro': _erro_legivel(resultado.detalhes), 'detalhes': resultado.detalhes}), 400

    if resultado.codigo in (NAO_ENCONTRADO, NEGADO):
        return jsonify({'erro': ERRO_SEM_ACESSO}), 403

    # Código novo no módulo sem tradução aqui: melhor 500 do que virar 403 calado.
    raise ValueError(f'Resultado sem tradução HTTP: {resultado.codigo}')


def _erro_legivel(detalhes: dict) -> str:
    """Com um único campo errado, a mensagem dele é melhor que um rótulo genérico."""
    if len(detalhes) == 1:
        return next(iter(detalhes.values()))
    return 'Payload inválido'


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
        payload = _normalizar_payload_lista(request.get_json(silent=True))
        resultado = lista_pessoal.adicionar(user_id, payload)
        return _resposta(resultado, 'Mídia adicionada à lista!', status_ok=201)
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
    """Atualizar progresso de consumo.

    O progresso é o motivo da chamada: sem ele não há o que fazer. O resto —
    teto, promoção a Concluído, dono do Item — é decisão do módulo.
    """
    try:
        user_id = get_jwt_identity()
        payload = _normalizar_payload_lista(request.get_json(silent=True))
        if 'progresso_atual' not in payload:
            return jsonify({
                'erro': 'Progresso é obrigatório',
                'detalhes': {'progresso_atual': 'Campo obrigatório'},
            }), 400

        resultado = lista_pessoal.atualizar(user_id, lista_id, payload)
        return _resposta(resultado, 'Progresso atualizado com sucesso!')
    except Exception as exc:
        print(f"Erro ao atualizar progresso: {exc}")
        return jsonify({'erro': f'Erro ao atualizar: {exc}'}), 500


@lista_bp.route('/<string:lista_id>', methods=['PUT'])
@jwt_required()
def atualizar_item_lista(lista_id):
    """Atualizar item da lista."""
    try:
        user_id = get_jwt_identity()
        payload = _normalizar_payload_lista(request.get_json(silent=True))
        resultado = lista_pessoal.atualizar(user_id, lista_id, payload)
        return _resposta(resultado, 'Lista atualizada com sucesso!')
    except Exception as exc:
        print(f"Erro ao atualizar lista: {exc}")
        return jsonify({'erro': f'Erro ao atualizar: {exc}'}), 500


@lista_bp.route('/<string:lista_id>', methods=['DELETE'])
@jwt_required()
def remover_item_lista(lista_id):
    """Remover item da lista."""
    try:
        user_id = get_jwt_identity()
        resultado = lista_pessoal.remover(user_id, lista_id)
        return _resposta(resultado, 'Mídia removida da lista')
    except Exception as exc:
        print(f"Erro ao remover da lista: {exc}")
        return jsonify({'erro': 'Erro ao remover mídia'}), 500
