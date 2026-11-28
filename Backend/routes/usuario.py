"""
Blueprint de usuário.
"""
from flask import Blueprint
from flask_jwt_extended import get_jwt_identity, jwt_required
from spectree import Response

from banco import consultar, consultar_um
from contrato import AUTENTICADO, ERROS_AUTENTICADA, CodigoErro, Erro, Mensagem, contrato, resposta_erro
from decorators import nivel_de_acesso
from dominio.conquistas import LIMITE_ATINGIDO, LIMITE_DE_DESTAQUES, NAO_OBTIDA
from repositories import destaques
from repositories.rotulos import sql_rotulos
from schemas.estado_consumo import CONCLUIDO, EM_PROGRESSO, PLATINADO
from schemas.usuario import RespostaDestaques, RespostaEstatisticas, RespostaPerfil, RespostaPermissoes

usuario_bp = Blueprint('usuario', __name__)

#: Antes era a procedure `obter_estatisticas_usuario`; agora é consulta da
#: aplicação (ADR-0007). Concluídos (Concluído + Platinado) e Em progresso pelos
#: Rótulos de cada Tipo, gerados do vocabulário de Estado de consumo.
ESTATISTICAS_POR_TIPO = f"""
    SELECT
        tm.nome_tipo AS tipo,
        tm.label AS label,
        count(DISTINCT lu.id_midia) AS total_midias,
        count(*) FILTER (WHERE lu.status_consumo IN ({sql_rotulos(CONCLUIDO, PLATINADO)})) AS concluidos,
        count(*) FILTER (WHERE lu.status_consumo IN ({sql_rotulos(EM_PROGRESSO)})) AS em_andamento,
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
@contrato.validate(
    resp=Response(HTTP_200=RespostaPerfil, HTTP_404=Erro, **ERROS_AUTENTICADA), tags=['usuario'], security=AUTENTICADO,
)
def obter_perfil():
    """Obter perfil completo do usuário."""
    perfil = consultar_um("SELECT * FROM vw_perfil_usuario WHERE id_usuario = %s", (get_jwt_identity(),))
    if not perfil:
        return resposta_erro(404, CodigoErro.NAO_ENCONTRADO, 'Perfil não encontrado')
    return {'perfil': perfil}


@usuario_bp.route('/permissoes', methods=['GET'])
@jwt_required()
@contrato.validate(
    resp=Response(HTTP_200=RespostaPermissoes, **ERROS_AUTENTICADA), tags=['usuario'], security=AUTENTICADO,
)
def obter_permissoes():
    """Obter o Nível de acesso do usuário."""
    return {'permissoes': {'nivel_acesso': nivel_de_acesso(get_jwt_identity())}}


@usuario_bp.route('/estatisticas', methods=['GET'])
@jwt_required()
@contrato.validate(
    resp=Response(HTTP_200=RespostaEstatisticas, **ERROS_AUTENTICADA), tags=['usuario'], security=AUTENTICADO,
)
def obter_estatisticas():
    """Obter estatísticas do usuário por tipo de mídia."""
    result = consultar(ESTATISTICAS_POR_TIPO, (get_jwt_identity(),))

    resumo = {
        'total_midias': sum(item.get('total_midias') or 0 for item in result),
        'concluidos': sum(item.get('concluidos') or 0 for item in result),
        'em_andamento': sum(item.get('em_andamento') or 0 for item in result),
        'favoritos': sum(item.get('favoritos') or 0 for item in result),
    }
    return {'estatisticas': result, 'resumo': resumo}


ERRO_NAO_OBTIDA = 'Conquista não encontrada entre as obtidas'
ERRO_LIMITE = f'O Perfil já tem {LIMITE_DE_DESTAQUES} destaques: tire um antes de pôr outro'


@usuario_bp.route('/conquistas/destaques', methods=['GET'])
@jwt_required()
@contrato.validate(
    resp=Response(HTTP_200=RespostaDestaques, **ERROS_AUTENTICADA), tags=['usuario'], security=AUTENTICADO,
)
def obter_destaques():
    """Conquistas em destaque no Perfil: as escolhidas ou, sem escolha, as obtidas mais raras; e o total."""
    return destaques.do_perfil(get_jwt_identity())


@usuario_bp.route('/conquistas/destaques/<int:steam_appid>/<path:codigo>', methods=['PUT'])
@jwt_required()
@contrato.validate(
    resp=Response(HTTP_200=Mensagem, HTTP_404=Erro, HTTP_409=Erro, **ERROS_AUTENTICADA),
    tags=['usuario'], security=AUTENTICADO,
)
def destacar_conquista(steam_appid, codigo):
    """Destacar no Perfil uma conquista obtida (appid do jogo e código da conquista); o sétimo responde 409."""
    resultado = destaques.destacar(get_jwt_identity(), steam_appid, codigo)
    if resultado == NAO_OBTIDA:
        return resposta_erro(404, CodigoErro.NAO_ENCONTRADO, ERRO_NAO_OBTIDA)
    if resultado == LIMITE_ATINGIDO:
        return resposta_erro(409, CodigoErro.LIMITE_DE_DESTAQUES, ERRO_LIMITE)
    return {'mensagem': 'Conquista destacada no Perfil'}


@usuario_bp.route('/conquistas/destaques/<int:steam_appid>/<path:codigo>', methods=['DELETE'])
@jwt_required()
@contrato.validate(
    resp=Response(HTTP_200=Mensagem, HTTP_404=Erro, **ERROS_AUTENTICADA), tags=['usuario'], security=AUTENTICADO,
)
def tirar_destaque(steam_appid, codigo):
    """Tirar uma conquista obtida dos destaques do Perfil."""
    if not destaques.tirar(get_jwt_identity(), steam_appid, codigo):
        return resposta_erro(404, CodigoErro.NAO_ENCONTRADO, ERRO_NAO_OBTIDA)
    return {'mensagem': 'Conquista tirada do Perfil'}
