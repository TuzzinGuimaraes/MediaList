"""Migração 0015: episódio novo automático (spec `episodio-novo`).

Roda o Alembic de verdade num banco descartável (as funções de apoio são as do teste da 0007).
Usa TEST_OWNER_DATABASE_URL (dono do banco, com CREATEDB); sem ela, pula.
"""
import psycopg
import pytest

from .test_migracao_email_normalizado_pg import (  # noqa: F401 (fixture)
    TEST_OWNER_DATABASE_URL,
    _alembic,
    _sql,
    banco_descartavel,
)

ANTERIOR = '0014_conclusao_antes_do_inicio'
NOVA = '0015_episodios'

pytestmark = pytest.mark.skipif(
    not TEST_OWNER_DATABASE_URL, reason='TEST_OWNER_DATABASE_URL ausente: sem dono do banco para migrar'
)


def _um(nome, sql, params=None):
    [linha] = _sql(nome, sql, params)
    return linha


def _cenario(nome):
    """Um Usuário e um anime do Catálogo com uma Atualização manual."""
    usuario = _um(nome, "INSERT INTO usuarios (nome_completo, email, senha_hash) VALUES ('U', 'u@x.test', 'x') "
                        'RETURNING id_usuario')['id_usuario']
    midia = _um(nome, "INSERT INTO midias (id_tipo, titulo_original) SELECT id_tipo, 'M' FROM tipo_midia "
                      "WHERE nome_tipo = 'anime' RETURNING id_midia")['id_midia']
    _sql(nome, 'INSERT INTO animes (id_midia, anilist_id) VALUES (%s, 1)', (midia,))
    _sql(nome, "INSERT INTO atualizacoes_midia (id_midia, tipo_atualizacao, titulo, dados_adicionais) "
               "VALUES (%s, 'episodio', 'Ep 1', '{\"episodio\": 1}')", (midia,))
    return usuario, midia


def _episodio(nome, midia, episodio, tipo='episodio'):
    _sql(nome, "INSERT INTO atualizacoes_midia (id_midia, tipo_atualizacao, titulo, dados_adicionais) "
               "VALUES (%s, %s, 'Ep', jsonb_build_object('episodio', %s::int))", (midia, tipo, episodio))


def test_upgrade_cria_colunas_indice_preferencia_e_cursor(banco_descartavel):  # noqa: F811
    nome = banco_descartavel
    _alembic(nome, 'upgrade', ANTERIOR)
    usuario, midia = _cenario(nome)

    _alembic(nome, 'upgrade', NOVA)

    assert _um(nome, 'SELECT avisar_episodios FROM usuarios WHERE id_usuario = %s', (usuario,)) == {
        'avisar_episodios': True,
    }
    assert _um(nome, 'SELECT episodios_lancados, proximo_episodio_em FROM animes WHERE id_midia = %s', (midia,)) == {
        'episodios_lancados': None, 'proximo_episodio_em': None,
    }
    _sql(nome, "UPDATE animes SET episodios_lancados = 3, proximo_episodio_em = '2026-11-27 15:00+00'")
    with pytest.raises(psycopg.errors.CheckViolation):
        _sql(nome, 'UPDATE animes SET episodios_lancados = -1')

    # Mesmo episódio da mesma Mídia não repete; outro episódio e outro tipo, sim.
    with pytest.raises(psycopg.errors.UniqueViolation):
        _episodio(nome, midia, 1)
    _episodio(nome, midia, 2)
    _episodio(nome, midia, 1, tipo='capitulo')
    _episodio(nome, midia, 1, tipo='capitulo')

    # O cursor do job é uma linha só.
    _sql(nome, "INSERT INTO episodios_cursor (exibido_ate) VALUES ('2026-11-27 12:00+00')")
    with pytest.raises(psycopg.errors.UniqueViolation):
        _sql(nome, "INSERT INTO episodios_cursor (exibido_ate) VALUES ('2026-11-27 13:00+00')")
    assert _um(nome, 'SELECT atualizado_em IS NOT NULL AS ok FROM episodios_cursor') == {'ok': True}


def test_downgrade_volta_o_schema(banco_descartavel):  # noqa: F811
    nome = banco_descartavel
    _alembic(nome, 'upgrade', ANTERIOR)
    _, midia = _cenario(nome)
    _alembic(nome, 'upgrade', NOVA)
    _sql(nome, "INSERT INTO episodios_cursor (exibido_ate) VALUES (now())")

    _alembic(nome, 'downgrade', ANTERIOR)

    colunas = {linha['column_name'] for linha in _sql(
        nome, "SELECT column_name FROM information_schema.columns WHERE table_name IN ('animes', 'usuarios')",
    )}
    assert not colunas & {'episodios_lancados', 'proximo_episodio_em', 'avisar_episodios'}
    assert _um(nome, "SELECT to_regclass('episodios_cursor') AS t")['t'] is None
    _episodio(nome, midia, 1)
    assert _um(nome, "SELECT count(*) AS n FROM atualizacoes_midia WHERE tipo_atualizacao = 'episodio'")['n'] == 2
