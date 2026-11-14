"""
Blueprint de moderação.
"""
from flask import Blueprint
from flask_jwt_extended import get_jwt_identity, jwt_required
from spectree import Response

import decorators
from banco import consultar, consultar_um, executar, transacao
from contrato import AUTENTICADO, CodigoErro, Erro, Pagina, contrato, montar_pagina, resposta_erro
from decorators import moderator_or_admin_required
from schemas.moderacao import (
    ConsultaUsuariosModeracao,
    RespostaAvaliacoesModeracao,
    StatusUsuarioAlterado,
    UsuarioModeracao,
)

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
        return resposta_erro(403, CodigoErro.ACESSO_NEGADO, 'Você não pode alterar o próprio status')

    alvo = consultar_um("SELECT id_usuario FROM usuarios WHERE id_usuario = %s", (target_user_id,))
    if not alvo:
        return resposta_erro(404, CodigoErro.NAO_ENCONTRADO, 'Usuário não encontrado')

    if _nivel(target_user_id) >= _nivel(ator):
        return resposta_erro(
            403, CodigoErro.ACESSO_NEGADO, 'Só é possível moderar usuários com nível de acesso menor que o seu',
        )

    if ativo:
        alterados = executar("UPDATE usuarios SET ativo = TRUE WHERE id_usuario = %s", (target_user_id,))
    else:
        # O access token já é recusado pelo `ativo` (app.py); os refresh tokens
        # são revogados junto, para que reativar exija login novo (ADR-0006).
        with transacao() as t:
            alterados = t.executar("UPDATE usuarios SET ativo = FALSE WHERE id_usuario = %s", (target_user_id,))
            t.executar(
                "UPDATE refresh_tokens SET revogado = TRUE WHERE id_usuario = %s AND revogado = FALSE",
                (target_user_id,),
            )
    if not alterados:
        # Apagado entre a leitura e o UPDATE.
        return resposta_erro(404, CodigoErro.NAO_ENCONTRADO, 'Usuário não encontrado')

    mensagem = 'Usuário ativado com sucesso' if ativo else 'Usuário desativado com sucesso'
    return {'mensagem': mensagem}


@moderacao_bp.route('/avaliacoes', methods=['GET'])
@jwt_required()
@moderator_or_admin_required
@contrato.validate(resp=Response(HTTP_200=RespostaAvaliacoesModeracao), tags=['moderacao'], security=AUTENTICADO)
def listar_avaliacoes_moderacao():
    """As 50 Avaliações mais recentes, para moderação."""
    query = """
        SELECT
            av.id_avaliacao, av.id_usuario, av.id_midia, av.nota, av.titulo_avaliacao, av.texto_avaliacao,
            av.data_avaliacao, av.data_edicao,
            u.nome_completo,
            m.titulo_portugues,
            m.titulo_original,
            tm.nome_tipo AS tipo
        FROM avaliacoes av
        JOIN usuarios u ON av.id_usuario = u.id_usuario
        JOIN midias m ON av.id_midia = m.id_midia
        JOIN tipo_midia tm ON m.id_tipo = tm.id_tipo
        ORDER BY av.data_avaliacao DESC, av.id_avaliacao DESC
        LIMIT 50
    """
    return {'avaliacoes': consultar(query)}


@moderacao_bp.route('/usuarios', methods=['GET'])
@jwt_required()
@moderator_or_admin_required
@contrato.validate(resp=Response(HTTP_200=Pagina[UsuarioModeracao]), tags=['moderacao'], security=AUTENTICADO)
def listar_usuarios_moderacao(query: ConsultaUsuariosModeracao):
    """Uma página dos Usuários, mais recentes primeiro, para moderação."""
    sql = """
        SELECT
            u.id_usuario,
            u.nome_completo,
            u.email,
            u.data_cadastro,
            u.ultimo_acesso,
            u.ativo,
            string_agg(DISTINCT gu.nome_grupo, ', ') AS grupos,
            COUNT(DISTINCT lu.id_midia) AS total_midias,
            COUNT(DISTINCT av.id_avaliacao) AS total_avaliacoes
        FROM usuarios u
        LEFT JOIN usuarios_grupos ug ON u.id_usuario = ug.id_usuario
        LEFT JOIN grupos_usuarios gu ON ug.id_grupo = gu.id_grupo
        LEFT JOIN lista_usuarios lu ON u.id_usuario = lu.id_usuario
        LEFT JOIN avaliacoes av ON u.id_usuario = av.id_usuario
        GROUP BY u.id_usuario
        ORDER BY u.data_cadastro DESC, u.id_usuario DESC
        LIMIT %s OFFSET %s
    """
    usuarios = consultar(sql, (query.por_pagina, (query.pagina - 1) * query.por_pagina))
    total = consultar_um('SELECT count(*) AS total FROM usuarios')['total']
    return montar_pagina(usuarios, total, query.pagina, query.por_pagina)


@moderacao_bp.route('/usuarios/<string:target_user_id>/desativar', methods=['PUT'])
@jwt_required()
@moderator_or_admin_required
@contrato.validate(
    resp=Response(HTTP_200=StatusUsuarioAlterado, HTTP_403=Erro, HTTP_404=Erro),
    tags=['moderacao'], security=AUTENTICADO,
)
def desativar_usuario(target_user_id):
    """Desativar usuário."""
    return _alterar_status(target_user_id, ativo=False)


@moderacao_bp.route('/usuarios/<string:target_user_id>/ativar', methods=['PUT'])
@jwt_required()
@moderator_or_admin_required
@contrato.validate(
    resp=Response(HTTP_200=StatusUsuarioAlterado, HTTP_403=Erro, HTTP_404=Erro),
    tags=['moderacao'], security=AUTENTICADO,
)
def ativar_usuario(target_user_id):
    """Ativar usuário."""
    return _alterar_status(target_user_id, ativo=True)
