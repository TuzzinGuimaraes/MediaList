"""Migração 0012: Notícia como Notificação, tokens de push e "Avisar sobre Notícias" (spec `noticias-avisos`).

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

ANTERIOR = '0011_jogos_por_popularidade'
NOVA = '0012_noticias_avisos'

pytestmark = pytest.mark.skipif(
    not TEST_OWNER_DATABASE_URL, reason='TEST_OWNER_DATABASE_URL ausente: sem dono do banco para migrar'
)


def _um(nome, sql, params=None):
    [linha] = _sql(nome, sql, params)
    return linha


def _cenario(nome):
    """Um Usuário, uma Mídia com Atualização notificada e uma Notícia."""
    usuario = _um(nome, "INSERT INTO usuarios (nome_completo, email, senha_hash) VALUES ('U', 'u@x.test', 'x') "
                        'RETURNING id_usuario')['id_usuario']
    midia = _um(nome, "INSERT INTO midias (id_tipo, titulo_original) SELECT id_tipo, 'M' FROM tipo_midia "
                      "WHERE nome_tipo = 'anime' RETURNING id_midia")['id_midia']
    atualizacao = _um(nome, "INSERT INTO atualizacoes_midia (id_midia, tipo_atualizacao, titulo) "
                            "VALUES (%s, 'episodio', 'Ep') RETURNING id_atualizacao", (midia,))['id_atualizacao']
    _sql(nome, 'INSERT INTO notificacoes (id_usuario, id_atualizacao) VALUES (%s, %s)', (usuario, atualizacao))
    noticia = _um(nome, "INSERT INTO noticias (titulo) VALUES ('N') RETURNING id_noticia")['id_noticia']
    return usuario, atualizacao, noticia


def test_notificacao_aceita_atualizacao_ou_noticia_e_so_uma(banco_descartavel):  # noqa: F811
    nome = banco_descartavel
    _alembic(nome, 'upgrade', ANTERIOR)
    usuario, atualizacao, noticia = _cenario(nome)

    _alembic(nome, 'upgrade', NOVA)

    _sql(nome, 'INSERT INTO notificacoes (id_usuario, id_noticia) VALUES (%s, %s)', (usuario, noticia))
    assert _um(nome, 'SELECT count(*) AS n FROM notificacoes')['n'] == 2
    with pytest.raises(psycopg.errors.CheckViolation):
        _sql(nome, 'INSERT INTO notificacoes (id_usuario) VALUES (%s)', (usuario,))
    with pytest.raises(psycopg.errors.CheckViolation):
        _sql(nome, 'INSERT INTO notificacoes (id_usuario, id_atualizacao, id_noticia) VALUES (%s, %s, %s)',
             (usuario, atualizacao, noticia))
    with pytest.raises(psycopg.errors.UniqueViolation):
        _sql(nome, 'INSERT INTO notificacoes (id_usuario, id_noticia) VALUES (%s, %s)', (usuario, noticia))

    _sql(nome, 'DELETE FROM noticias WHERE id_noticia = %s', (noticia,))
    assert _um(nome, 'SELECT count(*) AS n FROM notificacoes WHERE id_noticia IS NOT NULL')['n'] == 0


def test_push_tokens_e_avisar_noticias(banco_descartavel):  # noqa: F811
    nome = banco_descartavel
    _alembic(nome, 'upgrade', ANTERIOR)
    usuario, _, _ = _cenario(nome)

    _alembic(nome, 'upgrade', NOVA)

    assert _um(nome, 'SELECT avisar_noticias FROM usuarios WHERE id_usuario = %s', (usuario,)) == {
        'avisar_noticias': True,
    }
    _sql(nome, "INSERT INTO push_tokens (token, id_usuario, plataforma) VALUES ('ExponentPushToken[a]', %s, 'android')",
         (usuario,))
    token = _um(nome, 'SELECT criado_em, visto_em FROM push_tokens')
    assert token['criado_em'] is not None and token['visto_em'] is not None
    with pytest.raises(psycopg.errors.UniqueViolation):
        _sql(nome, "INSERT INTO push_tokens (token, id_usuario, plataforma) "
                   "VALUES ('ExponentPushToken[a]', %s, 'android')", (usuario,))
    with pytest.raises(psycopg.errors.CheckViolation):
        _sql(nome, "INSERT INTO push_tokens (token, id_usuario, plataforma) VALUES ('t2', %s, 'windows')", (usuario,))

    _sql(nome, 'DELETE FROM usuarios WHERE id_usuario = %s', (usuario,))
    assert _sql(nome, 'SELECT token FROM push_tokens') == []


def test_downgrade_tira_as_notificacoes_de_noticia_e_volta_o_schema(banco_descartavel):  # noqa: F811
    nome = banco_descartavel
    _alembic(nome, 'upgrade', ANTERIOR)
    usuario, atualizacao, noticia = _cenario(nome)
    _alembic(nome, 'upgrade', NOVA)
    _sql(nome, 'INSERT INTO notificacoes (id_usuario, id_noticia) VALUES (%s, %s)', (usuario, noticia))
    _sql(nome, "INSERT INTO push_tokens (token, id_usuario, plataforma) VALUES ('t', %s, 'android')", (usuario,))

    _alembic(nome, 'downgrade', ANTERIOR)

    assert _sql(nome, 'SELECT id_atualizacao FROM notificacoes') == [{'id_atualizacao': atualizacao}]
    colunas = {linha['column_name'] for linha in _sql(
        nome, "SELECT column_name FROM information_schema.columns WHERE table_name IN ('notificacoes', 'usuarios')",
    )}
    assert 'id_noticia' not in colunas and 'avisar_noticias' not in colunas
    assert _um(nome, "SELECT to_regclass('push_tokens') AS t")['t'] is None
    with pytest.raises(psycopg.errors.NotNullViolation):
        _sql(nome, 'INSERT INTO notificacoes (id_usuario) VALUES (%s)', (usuario,))
