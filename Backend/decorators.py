"""
Nível de acesso do Usuário e o decorador das rotas restritas ao admin (ADR 0012).
"""
from functools import wraps

from flask_jwt_extended import get_jwt_identity

from banco import consultar_um
from contrato import CodigoErro, resposta_erro

#: Nível de quem não está no banco: nada além do Usuário comum.
NIVEL_PADRAO = 'usuario'


def nivel_de_acesso(user_id):
    """`usuario` ou `admin`. Usuário inexistente é `usuario`; banco fora do ar
    levanta (503), em vez de virar "sem acesso"."""
    linha = consultar_um('SELECT nivel_acesso FROM usuarios WHERE id_usuario = %s', (user_id,))
    return linha['nivel_acesso'] if linha else NIVEL_PADRAO


def admin_required(f):
    """Rota só do admin; o resto recebe 403. Vem depois do `@jwt_required()`."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if nivel_de_acesso(get_jwt_identity()) != 'admin':
            return resposta_erro(403, CodigoErro.ACESSO_NEGADO, 'Acesso restrito a administradores')
        return f(*args, **kwargs)

    # O teste do contrato confere que a rota declara o 403 (ERROS_AUTENTICADA).
    decorated_function.exige_permissao = True
    return decorated_function
