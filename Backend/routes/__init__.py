"""
Blueprints da aplicação.
"""
from .admin import admin_bp
from .auth import auth_bp
from .avaliacoes import avaliacoes_bp
from .integracoes import integracoes_bp
from .lista import lista_bp
from .midias import midias_bp
from .moderacao import moderacao_bp
from .noticias import noticias_bp
from .preferencias import preferencias_bp
from .push import push_bp
from .usuario import usuario_bp
from .utils import utils_bp

__all__ = [
    'auth_bp',
    'usuario_bp',
    'midias_bp',
    'lista_bp',
    'avaliacoes_bp',
    'integracoes_bp',
    'noticias_bp',
    'moderacao_bp',
    'preferencias_bp',
    'push_bp',
    'utils_bp',
    'admin_bp',
]
