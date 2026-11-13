"""
Blueprint de mídias: adaptador HTTP do Catálogo (`repositories.catalogo`) e das
Atualizações de mídia (`repositories.atualizacoes`).

A rota lê os parâmetros, chama o módulo e responde. Os testes trocam
`catalogo` e `atualizacoes` deste módulo.
"""
from __future__ import annotations

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required

from decorators import permission_required
from parametros import POR_PAGINA_MAX, ler_int, ler_paginacao
from repositories.atualizacoes import Atualizacoes
from repositories.catalogo import Catalogo
from schemas import AnimeSchema, JogoSchema, MangaSchema, ValidationError

midias_bp = Blueprint('midias', __name__)

catalogo = Catalogo()
atualizacoes = Atualizacoes()

SCHEMA_BY_TYPE = {
    'anime': AnimeSchema(),
    'manga': MangaSchema(),
    'jogo': JogoSchema(),
}

#: Filtros de GET /midias, lidos da query string com o mesmo nome.
FILTROS = (
    'busca', 'genero', 'status', 'autor', 'estudio', 'demografia', 'plataforma', 'desenvolvedor', 'modo_jogo',
    'artista',
)

MIDIA_NAO_ENCONTRADA = ({'erro': 'Mídia não encontrada'}, 404)


@midias_bp.route('', methods=['GET'])
def listar_midias():
    """Listar mídias com filtros por tipo."""
    tipo = request.args.get('tipo')
    pagina, por_pagina = ler_paginacao()
    filtros = {nome: request.args.get(nome) for nome in FILTROS}
    filtros['ordem'] = request.args.get('ordem', 'nota_media')

    midias = catalogo.buscar(tipo, pagina=pagina, limite=por_pagina, filtros=filtros)
    return jsonify({'midias': midias, 'tipo': tipo, 'pagina': pagina, 'por_pagina': por_pagina}), 200


@midias_bp.route('/<string:id_midia>', methods=['GET'])
def detalhes_midia(id_midia):
    """Detalhes completos de qualquer mídia, com as Atualizações mais recentes."""
    midia = catalogo.obter(id_midia)
    if not midia:
        return MIDIA_NAO_ENCONTRADA

    return jsonify({**midia, 'atualizacoes': atualizacoes.recentes(id_midia)}), 200


@midias_bp.route('/<string:id_midia>', methods=['PUT'])
@jwt_required()
@permission_required('editar')
def atualizar_midia(id_midia):
    """Atualizar qualquer mídia pelo id central; o schema é o do Tipo dela."""
    existente = catalogo.obter(id_midia)
    if not existente:
        return MIDIA_NAO_ENCONTRADA

    try:
        payload = SCHEMA_BY_TYPE[existente['tipo']].load(request.get_json(silent=True) or {}, partial=True)
    except ValidationError as exc:
        return jsonify({'erro': 'Payload inválido', 'detalhes': exc.errors}), 400

    if not catalogo.atualizar(id_midia, payload):
        return MIDIA_NAO_ENCONTRADA
    return jsonify({'mensagem': 'Mídia atualizada com sucesso'}), 200


@midias_bp.route('/<string:id_midia>', methods=['DELETE'])
@jwt_required()
@permission_required('deletar')
def deletar_midia(id_midia):
    """Deletar mídia central."""
    if not catalogo.apagar(id_midia):
        return MIDIA_NAO_ENCONTRADA
    return jsonify({'mensagem': 'Mídia removida com sucesso'}), 200


@midias_bp.route('/<string:id_midia>/atualizacoes', methods=['POST'])
@jwt_required()
@permission_required('criar')
def criar_atualizacao_midia(id_midia):
    """Publicar uma Atualização de mídia, notificando quem tem a Mídia na Lista."""
    midia = catalogo.obter(id_midia)
    if not midia:
        return MIDIA_NAO_ENCONTRADA

    data = request.get_json(silent=True) or {}
    if not data.get('tipo') or not data.get('titulo'):
        return jsonify({'erro': 'Tipo e título são obrigatórios'}), 400

    dados_adicionais = data.get('dados_adicionais') or {}
    if not isinstance(dados_adicionais, dict):
        return jsonify({'erro': 'dados_adicionais deve ser um objeto'}), 400

    enviadas = atualizacoes.publicar(
        id_midia, midia['tipo'], data['tipo'], data['titulo'], data.get('descricao'), dados_adicionais,
    )
    return jsonify({'mensagem': 'Atualização adicionada!', 'notificacoes_enviadas': enviadas}), 201


@midias_bp.route('/<string:id_midia>/distribuicao', methods=['GET'])
def distribuicao_midia(id_midia):
    """Distribuição de status dos usuários para uma mídia."""
    return jsonify({'distribuicao': catalogo.distribuicao(id_midia)}), 200


@midias_bp.route('/trending', methods=['GET'])
def trending_midias():
    """Mídias mais bem avaliadas de um tipo."""
    tipo = request.args.get('tipo', 'anime')
    limite = ler_int('limite', 10, minimo=1, maximo=POR_PAGINA_MAX)
    return jsonify({'midias': catalogo.buscar(tipo, pagina=1, limite=limite, filtros={'ordem': 'nota_media'})}), 200
