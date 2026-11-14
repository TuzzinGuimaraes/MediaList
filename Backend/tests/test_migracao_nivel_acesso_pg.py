"""Migração 0005: Grupos viram um Nível de acesso por Usuário (ticket 35, ADR 0012).

Roda o Alembic de verdade num banco descartável, criado e apagado pelo teste:
upgrade até a head anterior, Usuários nos Grupos antigos (inclusive um
moderador e um Usuário em vários Grupos), upgrade para a 0005 e downgrade.

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
ANTERIOR = '0004_access_tokens_revogados'
NOVA = '0005_nivel_acesso'

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


def _alembic(nome, *args):
    partes = urlsplit(TEST_OWNER_DATABASE_URL)
    env = {
        **os.environ,
        'DB_HOST': partes.hostname, 'DB_PORT': str(partes.port or 5432), 'DB_NAME': nome,
        'DB_OWNER_USER': unquote(partes.username), 'DB_OWNER_PASSWORD': unquote(partes.password or ''),
    }
    subprocess.run(
        [sys.executable, '-m', 'alembic', *args], cwd=BACKEND, env=env, check=True,
        capture_output=True, text=True, timeout=120,
    )


def _sql(nome, sql, params=None):
    with psycopg.connect(_url_do_banco(nome), row_factory=dict_row, autocommit=True) as conn:
        cursor = conn.execute(sql, params)
        return cursor.fetchall() if cursor.description else None


def _usuario(nome, email, *grupos):
    [linha] = _sql(
        nome,
        "INSERT INTO usuarios (nome_completo, email, senha_hash) VALUES (%s, %s, 'x') RETURNING id_usuario",
        (email, email),
    )
    for grupo in grupos:
        _sql(
            nome,
            'INSERT INTO usuarios_grupos (id_usuario, id_grupo) '
            'SELECT %s, id_grupo FROM grupos_usuarios WHERE nome_grupo = %s',
            (linha['id_usuario'], grupo),
        )
    return email


def _niveis(nome):
    return {
        linha['email']: linha['nivel_acesso']
        for linha in _sql(nome, 'SELECT email, nivel_acesso FROM usuarios')
    }


def _tabelas(nome):
    return {
        linha['tablename']
        for linha in _sql(nome, "SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
    }


def test_grupos_viram_nivel_de_acesso_e_o_downgrade_recria_um_grupo_por_nivel(banco_descartavel):
    nome = banco_descartavel
    _alembic(nome, 'upgrade', ANTERIOR)
    _usuario(nome, 'admin@x.test', 'Administradores')
    _usuario(nome, 'mod@x.test', 'Moderadores')
    _usuario(nome, 'comum@x.test', 'Usuários')
    _usuario(nome, 'varios@x.test', 'Usuários', 'Moderadores', 'Administradores')
    _usuario(nome, 'mod-e-comum@x.test', 'Usuários', 'Moderadores')
    _usuario(nome, 'sem-grupo@x.test')

    _alembic(nome, 'upgrade', NOVA)

    assert _niveis(nome) == {
        'admin@x.test': 'admin',
        'mod@x.test': 'usuario',
        'comum@x.test': 'usuario',
        'varios@x.test': 'admin',
        'mod-e-comum@x.test': 'usuario',
        'sem-grupo@x.test': 'usuario',
    }
    assert not {'grupos_usuarios', 'usuarios_grupos'} & _tabelas(nome)
    # Cadastro sem Nível explícito é `usuario`; um Nível fora da lista é recusado.
    _sql(nome, "INSERT INTO usuarios (nome_completo, email, senha_hash) VALUES ('N', 'novo@x.test', 'x')")
    assert _niveis(nome)['novo@x.test'] == 'usuario'
    with pytest.raises(psycopg.errors.CheckViolation):
        _sql(nome, "UPDATE usuarios SET nivel_acesso = 'moderador' WHERE email = 'novo@x.test'")
    [perfil] = _sql(nome, "SELECT nivel_acesso FROM vw_perfil_usuario WHERE email = 'varios@x.test'")
    assert perfil['nivel_acesso'] == 'admin'

    _alembic(nome, 'downgrade', ANTERIOR)

    grupos = _sql(nome, 'SELECT nome_grupo, nivel_acesso FROM grupos_usuarios ORDER BY nivel_acesso')
    assert [(g['nome_grupo'], g['nivel_acesso']) for g in grupos] == [
        ('Administradores', 'admin'), ('Usuários', 'usuario'),
    ]
    associacoes = _sql(nome, """
        SELECT u.email, gu.nome_grupo
        FROM usuarios u JOIN usuarios_grupos ug USING (id_usuario) JOIN grupos_usuarios gu USING (id_grupo)
    """)
    assert {a['email']: a['nome_grupo'] for a in associacoes} == {
        'admin@x.test': 'Administradores',
        'mod@x.test': 'Usuários',
        'comum@x.test': 'Usuários',
        'varios@x.test': 'Administradores',
        'mod-e-comum@x.test': 'Usuários',
        'sem-grupo@x.test': 'Usuários',
        'novo@x.test': 'Usuários',
    }
    assert len(associacoes) == 7
    assert 'nivel_acesso' not in _sql(nome, 'SELECT * FROM usuarios LIMIT 1')[0]
    [perfil] = _sql(nome, "SELECT grupos FROM vw_perfil_usuario WHERE email = 'admin@x.test'")
    assert perfil['grupos'] == 'Administradores'

    # Ida e volta: o upgrade de novo dá o mesmo Nível a cada um.
    _alembic(nome, 'upgrade', NOVA)
    assert _niveis(nome)['admin@x.test'] == 'admin'
    assert _niveis(nome)['mod@x.test'] == 'usuario'
