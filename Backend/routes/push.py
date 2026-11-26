"""
Blueprint de push: o token Expo de cada aparelho (spec `noticias-avisos`, Q129).

O app registra o token depois do login e o renova ao abrir (`PUT`); no logout, remove (`DELETE`).
O token é a chave de `push_tokens`: registrar um token que já existe passa o token para o
Usuário logado (o aparelho trocou de conta).
"""
from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from spectree import Response

from banco import executar
from contrato import AUTENTICADO, ERROS_AUTENTICADA, Mensagem, contrato
from schemas.push import CorpoRegistrarToken, CorpoRemoverToken

push_bp = Blueprint('push', __name__)


@push_bp.route('/token', methods=['PUT'])
@jwt_required()
@contrato.validate(resp=Response(HTTP_200=Mensagem, **ERROS_AUTENTICADA), tags=['push'], security=AUTENTICADO)
def registrar_token(json: CorpoRegistrarToken):
    """Registrar ou renovar o token do aparelho; um token de outro Usuário muda de dono."""
    executar(
        """
        INSERT INTO push_tokens (token, id_usuario, plataforma)
        VALUES (%s, %s, %s)
        ON CONFLICT (token) DO UPDATE
            SET id_usuario = EXCLUDED.id_usuario, plataforma = EXCLUDED.plataforma, visto_em = now()
        """,
        (json.token, get_jwt_identity(), json.plataforma),
    )
    return {'mensagem': 'Token registrado'}


@push_bp.route('/token', methods=['DELETE'])
@jwt_required()
@contrato.validate(resp=Response(HTTP_200=Mensagem, **ERROS_AUTENTICADA), tags=['push'], security=AUTENTICADO)
def remover_token(json: CorpoRemoverToken):
    """Remover o token do aparelho (logout). Só apaga o token do próprio Usuário; sem ele, nada muda."""
    # O SpecTree documenta o corpo, mas não o valida no DELETE (passa None): valida aqui.
    json = json or CorpoRemoverToken.model_validate(request.get_json(silent=True) or {})
    executar('DELETE FROM push_tokens WHERE token = %s AND id_usuario = %s', (json.token, get_jwt_identity()))
    return {'mensagem': 'Token removido'}
