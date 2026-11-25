"""Migração 0009: `jogos.steam_appid`, `steam_appids.ignorado` e `vinculos_origem` (spec `nao-encontrados`).

Roda o Alembic de verdade num banco descartável (as funções de apoio são as do teste da 0007).
Usa TEST_OWNER_DATABASE_URL (dono do banco, com CREATEDB); sem ela, pula.
"""
import psycopg
import pytest

from .test_migracao_email_normalizado_pg import (  # noqa: F401 (fixture)
    TEST_OWNER_DATABASE_URL,
    _alembic,
    _revisao,
    _sql,
    banco_descartavel,
)

ANTERIOR = '0008_integracoes'
NOVA = '0009_nao_encontrados'

pytestmark = pytest.mark.skipif(
    not TEST_OWNER_DATABASE_URL, reason='TEST_OWNER_DATABASE_URL ausente: sem dono do banco para migrar'
)


def _colunas(nome, tabela):
    return {linha['column_name'] for linha in _sql(
        nome, 'SELECT column_name FROM information_schema.columns WHERE table_name = %s', (tabela,),
    )}


def _jogo(nome, titulo, **filha):
    id_midia = _sql(
        nome,
        "INSERT INTO midias (id_tipo, titulo_original) SELECT id_tipo, %s FROM tipo_midia WHERE nome_tipo = 'jogo' "
        'RETURNING id_midia',
        (titulo,),
    )[0]['id_midia']
    colunas = ', '.join(['id_midia', *filha])
    marcadores = ', '.join(['%s'] * (1 + len(filha)))
    _sql(nome, f'INSERT INTO jogos ({colunas}) VALUES ({marcadores})', (id_midia, *filha.values()))
    return id_midia


def test_upgrade_cria_o_schema_retenta_os_negativos_e_o_downgrade_desfaz(banco_descartavel):
    nome = banco_descartavel
    _alembic(nome, 'upgrade', ANTERIOR)
    casado = _jogo(nome, 'Casado', rawg_slug='casado')
    _sql(nome, "INSERT INTO steam_appids (appid, id_midia, nome) VALUES (10, %s, 'Casado')", (casado,))
    _sql(nome, "INSERT INTO steam_appids (appid, id_midia, nome) VALUES (20, NULL, 'Negativo')")

    _alembic(nome, 'upgrade', NOVA)

    assert 'steam_appid' in _colunas(nome, 'jogos')
    linhas = {r['appid']: r for r in _sql(
        nome, "SELECT appid, ignorado, tentado_em < now() - interval '30 days' AS vencido FROM steam_appids",
    )}
    assert linhas[10] == {'appid': 10, 'ignorado': False, 'vencido': False}
    # Os negativos de antes do fallback passam pela loja da Steam na próxima sincronização.
    assert linhas[20] == {'appid': 20, 'ignorado': False, 'vencido': True}

    _jogo(nome, 'Da Steam', steam_appid=30)
    with pytest.raises(psycopg.errors.UniqueViolation):
        _jogo(nome, 'Outro', steam_appid=30)

    usuario = _sql(nome, "INSERT INTO usuarios (nome_completo, email, senha_hash) VALUES ('U', 'u@x.test', 'x') "
                         'RETURNING id_usuario')[0]['id_usuario']
    anime = _sql(nome, "INSERT INTO midias (id_tipo, titulo_original) SELECT id_tipo, 'A' FROM tipo_midia "
                       "WHERE nome_tipo = 'anime' RETURNING id_midia")[0]['id_midia']
    vinculo = ("INSERT INTO vinculos_origem (plataforma, origem_id, tipo, id_midia, id_usuario) "
               'VALUES (%s, %s, %s, %s, %s)')
    _sql(nome, vinculo, ('mal', '1', 'anime', anime, usuario))
    # No MAL, anime 1 e mangá 1 são obras diferentes: a unicidade inclui o Tipo.
    _sql(nome, vinculo, ('mal', '1', 'manga', anime, usuario))
    with pytest.raises(psycopg.errors.UniqueViolation):
        _sql(nome, vinculo, ('mal', '1', 'anime', anime, usuario))
    with pytest.raises(psycopg.errors.CheckViolation):
        _sql(nome, vinculo, ('outra', '1', 'anime', anime, usuario))
    criado = _sql(nome, 'SELECT id, criado_em FROM vinculos_origem LIMIT 1')[0]
    assert criado['id'] and criado['criado_em']
    # O autor some, o vínculo fica (sem autor).
    _sql(nome, 'DELETE FROM usuarios WHERE id_usuario = %s', (usuario,))
    assert _sql(nome, 'SELECT count(*) AS n FROM vinculos_origem WHERE id_usuario IS NULL')[0]['n'] == 2

    _alembic(nome, 'downgrade', ANTERIOR)

    assert 'steam_appid' not in _colunas(nome, 'jogos')
    assert 'ignorado' not in _colunas(nome, 'steam_appids')
    assert not _colunas(nome, 'vinculos_origem')

    _alembic(nome, 'upgrade', NOVA)
    assert _revisao(nome) == NOVA
