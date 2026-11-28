"""
Blueprint das Sugestões (spec `sugestoes`): adaptador HTTP de `repositories.sugestoes` e
`dominio.sugestoes`. Entrada e saída seguem `schemas/sugestoes.py` (ADR 0011).
"""
from __future__ import annotations

from flask import Blueprint
from flask_jwt_extended import get_jwt_identity, jwt_required
from spectree import Response

from contrato import AUTENTICADO, ERROS_AUTENTICADA, contrato
from dominio.sugestoes import NOTA_MINIMA, completar_com_em_alta, montar_faixa, sugerir
from repositories.sugestoes import Sugestoes
from schemas.sugestoes import ConsultaSugestoes, RespostaSugestoes

sugestoes_bp = Blueprint('sugestoes', __name__)

sugestoes = Sugestoes()


@sugestoes_bp.route('', methods=['GET'])
@jwt_required()
@contrato.validate(
    resp=Response(HTTP_200=RespostaSugestoes, **ERROS_AUTENTICADA), tags=['sugestoes'], security=AUTENTICADO,
)
def listar_sugestoes(query: ConsultaSugestoes):
    """Sugestões para o Usuário: até 12 animes ou mangás do Catálogo, pelo gosto dele, com o motivo.
    Abaixo de 12, o Em alta do recorte completa a faixa."""
    id_usuario = get_jwt_identity()
    tipos = [query.tipo] if query.tipo else ['anime', 'manga']

    escolhidas = sugerir(sugestoes.recomendacoes(id_usuario, tipos, NOTA_MINIMA))
    faixa, faltam = montar_faixa(escolhidas, sugestoes.midias([s['id_midia'] for s in escolhidas]))
    em_alta = sugestoes.em_alta(id_usuario, tipos, [s['id_midia'] for s in faixa], faltam)
    return {'sugestoes': completar_com_em_alta(faixa, em_alta)}
