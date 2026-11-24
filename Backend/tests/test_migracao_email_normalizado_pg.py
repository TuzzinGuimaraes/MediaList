"""Migração 0007: emails normalizados e índice único em lower(email) (spec `login-ux`).

Roda o Alembic de verdade num banco descartável, criado e apagado pelo teste.

Usa TEST_OWNER_DATABASE_URL (dono do banco, com CREATEDB); sem ela, pula.
"""
import os
import pathlib
import subprocess
import sys
import uuid
from urllib.parse import unquote, urlsplit

import psycopg
import pytest
from psycopg.rows import dict_row

TEST_OWNER_DATABASE_URL = os.getenv('TEST_OWNER_DATABASE_URL')
BACKEND = pathlib.Path(__file__).resolve().parents[1]
ANTERIOR = '0006_producao'
NOVA = '0007_email_normalizado'

pytestmark = pytest.mark.skipif(
    not TEST_OWNER_DATABASE_URL, reason='TEST_OWNER_DATABASE_URL ausente: sem dono do banco para migrar'
)


def _url_do_banco(nome):
    partes = urlsplit(TEST_OWNER_DATABASE_URL)
    return partes._replace(path=f'/{nome}').geturl()


@pytest.fixture
def banco_descartavel():
    """Banco vazio só deste teste; apagado no fim, mesmo com falha."""
    nome = f'medialist_migracao_{uuid.uuid4().hex[:12]}'
    with psycopg.connect(TEST_OWNER_DATABASE_URL, autocommit=True) as conn:
        conn.execute(f'CREATE DATABASE "{nome}"')
    try:
        yield nome
    finally:
        with psycopg.connect(TEST_OWNER_DATABASE_URL, autocommit=True) as conn:
            conn.execute(f'DROP DATABASE IF EXISTS "{nome}" WITH (FORCE)')


def _alembic(nome, *args, check=True):
    partes = urlsplit(TEST_OWNER_DATABASE_URL)
    env = {
        **os.environ,
        'DB_HOST': partes.hostname, 'DB_PORT': str(partes.port or 5432), 'DB_NAME': nome,
        'DB_OWNER_USER': unquote(partes.username), 'DB_OWNER_PASSWORD': unquote(partes.password or ''),
    }
    return subprocess.run(
        [sys.executable, '-m', 'alembic', *args], cwd=BACKEND, env=env, check=check,
        capture_output=True, text=True, timeout=120,
    )


def _sql(nome, sql, params=None):
    with psycopg.connect(_url_do_banco(nome), row_factory=dict_row, autocommit=True) as conn:
        cursor = conn.execute(sql, params)
        return cursor.fetchall() if cursor.description else None


def _usuario(nome, email):
    _sql(nome, "INSERT INTO usuarios (nome_completo, email, senha_hash) VALUES ('U', %s, 'x')", (email,))


def _emails(nome):
    return sorted(linha['email'] for linha in _sql(nome, 'SELECT email FROM usuarios'))


def _revisao(nome):
    return _sql(nome, 'SELECT version_num FROM alembic_version')[0]['version_num']


def test_upgrade_normaliza_troca_a_unique_e_o_downgrade_restaura(banco_descartavel):
    nome = banco_descartavel
    _alembic(nome, 'upgrade', ANTERIOR)
    _usuario(nome, 'ja@normal.test')
    _usuario(nome, 'Maiuscula@Exemplo.TEST')
    _usuario(nome, '  espacos@exemplo.test \t')
    _usuario(nome, '\u00a0nbsp@exemplo.test\u00a0')
    _usuario(nome, '\u200bzero\u200dwidth@exemplo.test\ufeff')

    _alembic(nome, 'upgrade', NOVA)

    assert _emails(nome) == [
        'espacos@exemplo.test', 'ja@normal.test', 'maiuscula@exemplo.test',
        'nbsp@exemplo.test', 'zerowidth@exemplo.test',
    ]
    with pytest.raises(psycopg.errors.UniqueViolation) as exc:
        _usuario(nome, 'JA@normal.test')
    assert exc.value.diag.constraint_name == 'uq_usuarios_email_lower'

    _alembic(nome, 'downgrade', ANTERIOR)

    restricoes = _sql(
        nome, "SELECT conname FROM pg_constraint WHERE conrelid = 'usuarios'::regclass AND contype = 'u'",
    )
    assert [r['conname'] for r in restricoes] == ['usuarios_email_key']
    assert not _sql(nome, "SELECT 1 FROM pg_indexes WHERE indexname = 'uq_usuarios_email_lower'")
    with pytest.raises(psycopg.errors.UniqueViolation):
        _usuario(nome, 'ja@normal.test')
    # Sem o índice em lower(email), a outra caixa volta a entrar.
    _usuario(nome, 'JA@normal.test')
    _sql(nome, "DELETE FROM usuarios WHERE email = 'JA@normal.test'")

    # Ida e volta.
    _alembic(nome, 'upgrade', NOVA)
    assert _revisao(nome) == NOVA


def test_colisao_depois_de_normalizar_falha_com_mensagem_e_nao_muda_nada(banco_descartavel):
    nome = banco_descartavel
    _alembic(nome, 'upgrade', ANTERIOR)
    _usuario(nome, 'Fulano@Exemplo.test')
    _usuario(nome, 'fulano@exemplo.test ')
    _usuario(nome, 'outro@Exemplo.test')

    resultado = _alembic(nome, 'upgrade', NOVA, check=False)

    assert resultado.returncode != 0
    assert 'ficam iguais depois de normalizados' in resultado.stderr
    assert 'fulano@exemplo.test' in resultado.stderr
    assert _revisao(nome) == ANTERIOR
    assert _emails(nome) == ['Fulano@Exemplo.test', 'fulano@exemplo.test ', 'outro@Exemplo.test']
