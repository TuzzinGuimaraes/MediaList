"""Migração 0017: as Relações entre Mídias (spec `relacoes`, Q186–Q205).

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

ANTERIOR = '0016_temporada'
NOVA = '0017_relacoes'

pytestmark = pytest.mark.skipif(
    not TEST_OWNER_DATABASE_URL, reason='TEST_OWNER_DATABASE_URL ausente: sem dono do banco para migrar'
)


def _um(nome, sql, params=None):
    [linha] = _sql(nome, sql, params)
    return linha


def _anime(nome, anilist_id):
    midia = _um(nome, "INSERT INTO midias (id_tipo, titulo_original) SELECT id_tipo, 'A' "
                      "FROM tipo_midia WHERE nome_tipo = 'anime' RETURNING id_midia")['id_midia']
    _sql(nome, 'INSERT INTO animes (id_midia, anilist_id) VALUES (%s, %s)', (midia, anilist_id))
    return midia


def _relacao(nome, midia, relacao='SEQUEL', fonte='AniList', tipo='anime', anilist_id=2, slug=None):
    _sql(nome, 'INSERT INTO relacoes_midia (id_midia, relacao, fonte, tipo_destino, destino_anilist_id, '
               "destino_rawg_slug, titulo) VALUES (%s, %s, %s, %s, %s, %s, 'B')",
         (midia, relacao, fonte, tipo, anilist_id, slug))


def test_upgrade_cria_as_relacoes_com_cascata_na_origem(banco_descartavel):  # noqa: F811
    nome = banco_descartavel
    _alembic(nome, 'upgrade', NOVA)
    origem, destino = _anime(nome, 1), _anime(nome, 2)
    _relacao(nome, origem, anilist_id=2)
    _relacao(nome, origem, relacao='MESMA_SERIE', fonte='RAWG', tipo='jogo', anilist_id=None, slug='portal-2')

    # A Mídia de destino é só a identidade na fonte: apagá-la não mexe na Relação.
    _sql(nome, 'DELETE FROM midias WHERE id_midia = %s', (destino,))
    assert _um(nome, 'SELECT count(*) AS n FROM relacoes_midia')['n'] == 2

    _sql(nome, 'DELETE FROM midias WHERE id_midia = %s', (origem,))
    assert _um(nome, 'SELECT count(*) AS n FROM relacoes_midia')['n'] == 0


def test_upgrade_recusa_o_mesmo_destino_duas_vezes_na_mesma_origem(banco_descartavel):  # noqa: F811
    nome = banco_descartavel
    _alembic(nome, 'upgrade', NOVA)
    origem = _anime(nome, 1)
    _relacao(nome, origem, relacao='SEQUEL', anilist_id=2)
    _relacao(nome, origem, relacao='ADAPTATION', tipo='manga', anilist_id=2)  # outro Tipo, outro destino
    _relacao(nome, origem, relacao='MESMA_SERIE', fonte='RAWG', tipo='jogo', anilist_id=None, slug='a')

    with pytest.raises(psycopg.errors.UniqueViolation):
        _relacao(nome, origem, relacao='SIDE_STORY', anilist_id=2)
    with pytest.raises(psycopg.errors.UniqueViolation):
        _relacao(nome, origem, relacao='MESMA_SERIE', fonte='RAWG', tipo='jogo', anilist_id=None, slug='a')


@pytest.mark.parametrize('campos', [
    {'relacao': 'sequel'},
    {'fonte': 'MAL'},
    {'tipo': 'filme'},
    {'fonte': 'AniList', 'tipo': 'jogo', 'anilist_id': None, 'slug': 'a'},
    {'fonte': 'RAWG', 'tipo': 'anime'},
    {'anilist_id': None},
    {'slug': 'a'},
])
def test_upgrade_recusa_relacao_invalida(banco_descartavel, campos):  # noqa: F811
    nome = banco_descartavel
    _alembic(nome, 'upgrade', NOVA)
    origem = _anime(nome, 1)

    with pytest.raises(psycopg.errors.CheckViolation):
        _relacao(nome, origem, **campos)


def test_downgrade_volta_o_schema(banco_descartavel):  # noqa: F811
    nome = banco_descartavel
    _alembic(nome, 'upgrade', NOVA)
    _relacao(nome, _anime(nome, 1))

    _alembic(nome, 'downgrade', ANTERIOR)

    assert _um(nome, "SELECT to_regclass('relacoes_midia') AS t")['t'] is None
    assert _um(nome, 'SELECT count(*) AS n FROM animes')['n'] == 1
