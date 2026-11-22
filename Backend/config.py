"""
Configurações centrais da aplicação.
"""
import os
import sys
from datetime import timedelta
from urllib.parse import quote

from dotenv import load_dotenv


def _forcar_saida_utf8() -> None:
    """Garante que stdout/stderr aceitem os emojis das mensagens de log.

    No Windows, quando a saída não é um console — pipe, arquivo de log, um
    serviço, o CI — o Python usa a codificação da localidade (cp1252), que não
    codifica emoji. Um simples `print("✅ ...")` levanta UnicodeEncodeError e,
    quando isso acontece dentro de um `except`, derruba a aplicação na
    inicialização. Reconfigurar aqui cobre todos os pontos de entrada, porque
    este módulo é importado por todos eles.
    """
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, 'reconfigure', None)
        if reconfigure is None:
            continue
        try:
            reconfigure(encoding='utf-8', errors='replace')
        except (ValueError, OSError):
            # Fluxo já fechado ou não reconfigurável: não é motivo para abortar.
            pass


_forcar_saida_utf8()

load_dotenv()
APP_ENV = os.getenv('APP_ENV', 'development')
EM_PRODUCAO = APP_ENV == 'production'

# Defaults de desenvolvimento. Em produção nenhum deles é aceito: o app recusa
# iniciar (ver _validar_segredos_de_producao, no fim do módulo).
_JWT_SECRET_DEV = 'sua-chave-secreta-super-segura'
_DB_PASSWORD_DEV = 'MediaList@2025!Secure'
_JWT_SECRETS_CONHECIDOS = {_JWT_SECRET_DEV, 'troque-esta-chave-em-producao'}
# Senha do dono: só conta quando o dono é usado (DB_OWNER_USER definido, como
# no serviço migrate). O backend não recebe DB_OWNER_* e não precisa dela.
_DB_OWNER_PASSWORD_DEV = 'medialist-owner-dev'


def _env(nome, default):
    """Variável de ambiente; vazia conta como ausente e cai no default."""
    return os.getenv(nome) or default


# Configuração JWT
JWT_SECRET_KEY = _env('JWT_SECRET_KEY', _JWT_SECRET_DEV)
JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=int(os.getenv('JWT_ACCESS_TOKEN_DAYS', '1')))
# Refresh token opaco e rotativo (ADR-0006). Não é JWT: vale o que está na
# tabela `refresh_tokens`, então expira e é revogado no banco.
REFRESH_TOKEN_EXPIRES = timedelta(days=int(os.getenv('JWT_REFRESH_TOKEN_DAYS', '30')))

# Pool do PostgreSQL (módulo `banco`), por processo: com N workers do gunicorn
# o banco vê até N * DB_POOL_MAX conexões. O timeout (segundos) vale para abrir
# conexão e para esperar uma livre no pool; estourado, a API responde 503.
DB_POOL_MIN = int(os.getenv('DB_POOL_MIN', '1'))
DB_POOL_MAX = int(os.getenv('DB_POOL_MAX', '10'))
DB_POOL_TIMEOUT = float(os.getenv('DB_POOL_TIMEOUT', '5'))


def database_url(*, dono: bool = False) -> str:
    """URL do PostgreSQL (postgresql://user:pass@host:port/name).

    Em produção (Neon, ADR-0013) a URL vem pronta: DATABASE_URL para o usuário
    da aplicação e DATABASE_OWNER_URL para o dono, usadas como vêm (já com
    `sslmode=require`). Sem elas, como no dev e no compose, a URL é montada das
    DB_*: o usuário da aplicação (DB_USER/DB_PASSWORD, só DML) ou, com
    `dono=True`, DB_OWNER_USER/DB_OWNER_PASSWORD. Sem nenhum dono configurado
    levanta RuntimeError em vez de migrar com o usuário da aplicação, que não
    tem DDL. Usuário e senha vão escapados: '@', ':' e '/' não quebram a URL.
    """
    pronta = os.getenv('DATABASE_OWNER_URL' if dono else 'DATABASE_URL')
    if pronta:
        return pronta
    user = _env('DB_USER', 'media_app_user')
    password = _env('DB_PASSWORD', _DB_PASSWORD_DEV)
    if dono:
        if not os.getenv('DB_OWNER_USER'):
            raise RuntimeError(
                'DATABASE_OWNER_URL e DB_OWNER_USER ausentes: as migrações rodam com o dono do banco, '
                'não com o usuário da aplicação. Defina DATABASE_OWNER_URL, ou DB_OWNER_USER e DB_OWNER_PASSWORD.'
            )
        user = os.environ['DB_OWNER_USER']
        password = os.getenv('DB_OWNER_PASSWORD', '')
    host = _env('DB_HOST', 'localhost')
    port = _env('DB_PORT', '5433')
    name = _env('DB_NAME', 'medialist_db')
    return f'postgresql://{quote(user, safe="")}:{quote(password, safe="")}@{host}:{port}/{name}'

# Configurações das APIs de importação
ANILIST_API_URL = os.getenv('ANILIST_API_URL', 'https://graphql.anilist.co')
RAWG_API_KEY = os.getenv('RAWG_API_KEY', '')
RAWG_API_URL = os.getenv('RAWG_API_URL', 'https://api.rawg.io/api')


def _problema_do_segredo(nome, conhecidos, ausente):
    """`ausente` se a variável falta, aviso se é um default conhecido, senão None."""
    valor = os.getenv(nome)
    if not valor:
        return ausente
    if valor in conhecidos:
        return f'{nome} igual a um default conhecido'
    return None


def _problemas_de_producao():
    """Segredos ausentes ou iguais a um default conhecido."""
    problemas = [_problema_do_segredo('JWT_SECRET_KEY', _JWT_SECRETS_CONHECIDOS, 'JWT_SECRET_KEY ausente')]
    # Com DATABASE_URL a senha do banco vem na URL: DB_PASSWORD não é usada.
    if not os.getenv('DATABASE_URL'):
        problemas.append(_problema_do_segredo(
            'DB_PASSWORD', {_DB_PASSWORD_DEV}, 'DATABASE_URL ausente (ou DB_PASSWORD, para montar a URL das DB_*)',
        ))
    if os.getenv('DB_OWNER_USER'):
        problemas.append(_problema_do_segredo(
            'DB_OWNER_PASSWORD', {_DB_OWNER_PASSWORD_DEV}, 'DB_OWNER_PASSWORD ausente',
        ))
    return [problema for problema in problemas if problema]


def _validar_segredos_de_producao():
    problemas = _problemas_de_producao()
    if problemas:
        raise SystemExit(
            'APP_ENV=production recusou iniciar: ' + '; '.join(problemas)
        )


if EM_PRODUCAO:
    _validar_segredos_de_producao()
