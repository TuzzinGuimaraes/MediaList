"""
Gravação da Importação no PostgreSQL (ticket 23), pelo módulo `banco`.

Cada Mídia é gravada por um único comando, que é a transação dela (a conexão fica em
autocommit, `banco.autocommit()`): o upsert da base em `midias` e da tabela filha do Tipo
pela chave da fonte (`anilist_id` ou `rawg_slug`), os gêneros e as ligações. Uma ida e volta
ao banco por Mídia; a Importação usa uma conexão por página (`t`), e Mídia que falha não leva
as outras junto. Reimportar atualiza a Mídia no lugar;
Avaliações e Itens não são tocados. A Nota média não é gravada: é calculada na
leitura (ticket 13); a Importação grava só a Nota da fonte (`nota_fonte`) e, nos animes, as
colunas da fonte do Tipo (`colunas_fonte`: Temporada, formato, Popularidade da fonte).

O mapa Tipo → tabela/colunas é o de `tipos_midia`, o mesmo do Catálogo. As Relações das Mídias
de uma página vão numa transação à parte (`salvar_relacoes`), que troca as que elas tinham.
"""
from __future__ import annotations

from psycopg.types.json import Jsonb

from banco import Conflito, Transacao, autocommit
from tipos_midia import COLUNAS_BASE, TIPOS, TipoMidia, valor_de_coluna

#: A Importação grava a base que a API grava mais a Nota da fonte.
_BASE = (*COLUNAS_BASE, 'nota_fonte')


def _marcadores(colunas) -> str:
    return ', '.join(f'%({c})s' for c in colunas)


def _atribuicoes(colunas) -> str:
    return ', '.join(f'{c} = %({c})s' for c in colunas)


def _midia(config: TipoMidia) -> str:
    """CTEs do upsert da Mídia; `resultado` dá (id_midia, ja_existia, atualizada).

    Atualiza a Mídia que já tem a chave da fonte, ou cria base e filha. Duas importações da
    mesma chave ao mesmo tempo: as duas criam, e a segunda esbarra na UNIQUE da chave ao inserir
    a filha (Conflito); o comando dela é desfeito inteiro, sem Mídia órfã.

    `chaves_extras` (o `steam_appid` do jogo) também acham a Mídia quando um dos lados não tem a
    chave da fonte: o jogo criado pela loja da Steam e depois importado do RAWG é a mesma Mídia,
    que ganha o `rawg_slug`. Dado sem a chave da fonte não sobrescreve Mídia que a tem
    (`atualizada` falso: a fonte do Tipo manda). Extra que já é de outra Mídia não é gravada
    (duas entradas do RAWG na mesma appid: cada uma tem a sua Mídia, a appid fica com a primeira).
    """
    tabela, chave, extras = config.tabela, config.chave_fonte, config.chaves_extras
    colunas = (*config.colunas, *config.colunas_fonte)
    gravaveis = (*config.colunas_gravaveis, *config.colunas_fonte)
    achar = ' OR '.join([
        f'{chave} = %({chave})s',
        *(f'({e} = %({e})s AND ({chave} IS NULL OR %({chave})s::text IS NULL))' for e in extras),
    ])

    def livre(extra: str, outra_que_nao: str = '') -> str:
        return (f'CASE WHEN EXISTS (SELECT 1 FROM {tabela} o WHERE o.{extra} = %({extra})s{outra_que_nao}) '
                f'THEN NULL ELSE %({extra})s END')

    chaves = [f'{chave} = COALESCE({tabela}.{chave}, %({chave})s)'] + [
        f'{e} = COALESCE({tabela}.{e}, {livre(e, f" AND o.id_midia <> {tabela}.id_midia")})' for e in extras
    ]
    return f"""
        existente AS (
            SELECT id_midia, ({chave} IS NULL OR %({chave})s::text IS NOT NULL) AS atualizar FROM {tabela}
            WHERE {achar}
            ORDER BY ({chave} = %({chave})s) IS TRUE DESC
            LIMIT 1
        ), base_atualizada AS (
            UPDATE midias SET {_atribuicoes(_BASE)}
            WHERE id_midia = (SELECT id_midia FROM existente WHERE atualizar)
        ), filha_atualizada AS (
            UPDATE {tabela} SET {', '.join([_atribuicoes(colunas), *chaves])}
            WHERE id_midia = (SELECT id_midia FROM existente WHERE atualizar)
        ), criada AS (
            INSERT INTO midias (id_tipo, {', '.join(_BASE)})
            SELECT id_tipo, {_marcadores(_BASE)} FROM tipo_midia
            WHERE nome_tipo = %(tipo)s AND NOT EXISTS (SELECT 1 FROM existente)
            RETURNING id_midia
        ), filha_criada AS (
            INSERT INTO {tabela} (id_midia, {', '.join((*gravaveis, *extras))})
            SELECT id_midia, {', '.join([_marcadores(gravaveis), *map(livre, extras)])} FROM criada
            RETURNING id_midia
        ), resultado AS (
            SELECT id_midia, true AS ja_existia, atualizar AS atualizada FROM existente
            UNION ALL
            SELECT id_midia, false AS ja_existia, true AS atualizada FROM filha_criada
        )
    """


def _upsert(config: TipoMidia) -> str:
    """Um comando grava a Mídia, os gêneros dela e as ligações: uma ida ao banco por Mídia.

    Mídia que não foi atualizada (a fonte do Tipo manda) também não ganha os gêneros. Gênero que
    já existe ganha este Tipo no `aplicavel_a`, se ainda não tem. O gênero é achado pelo que o
    comando inseriu ou atualizou (RETURNING) ou pelo que já estava no banco quando ele começou:
    o criado por outra importação depois disso, e que já tem este Tipo, fica de fora, e
    `faltou_genero` avisa para gravar de novo (o comando seguinte já o vê).
    """
    return f"""
        WITH {_midia(config)}, genero_gravado AS (
            INSERT INTO generos (nome_genero, aplicavel_a)
            SELECT nome, %(aplicavel_a)s::text[] FROM unnest(%(generos)s::text[]) AS nome
            WHERE (SELECT atualizada FROM resultado)
            ORDER BY nome
            ON CONFLICT (nome_genero) DO UPDATE SET aplicavel_a = ARRAY(
                SELECT DISTINCT unnest(generos.aplicavel_a || EXCLUDED.aplicavel_a) ORDER BY 1)
            WHERE NOT generos.aplicavel_a @> EXCLUDED.aplicavel_a
            RETURNING id_genero
        ), genero AS (
            SELECT id_genero FROM genero_gravado
            UNION
            SELECT id_genero FROM generos WHERE nome_genero = ANY(%(generos)s::text[])
        ), ligada AS (
            INSERT INTO midias_generos (id_midia, id_genero)
            SELECT r.id_midia, g.id_genero FROM resultado r CROSS JOIN genero g WHERE r.atualizada
            ON CONFLICT DO NOTHING
        )
        SELECT id_midia, ja_existia,
               atualizada AND (SELECT count(*) FROM genero) < cardinality(%(generos)s::text[]) AS faltou_genero
        FROM resultado
    """


def _gravar(t: Transacao, tipo: str, valores: dict, generos: list[str]) -> dict:
    config = TIPOS[tipo]
    nomes = list(dict.fromkeys(g.strip() for g in generos if g and g.strip()))
    params = {**valores, 'tipo': tipo, 'generos': nomes, 'aplicavel_a': config.aplicavel_a}
    gravada = t.consultar_um(_upsert(config), params)
    if gravada['faltou_genero']:
        gravada = t.consultar_um(_upsert(config), params)
    return {'id_midia': gravada['id_midia'], 'ja_existia': gravada['ja_existia']}


def _salvar(tipo: str, dados: dict, generos: list[str], t: Transacao | None = None) -> dict:
    config = TIPOS[tipo]
    chaves = (config.chave_fonte, *config.chaves_extras)
    if not any(dados.get(c) for c in chaves):
        raise ValueError(f'{tipo} sem {" nem ".join(chaves)}: não há como reimportar sem duplicar')

    valores = {c: valor_de_coluna(c, dados.get(c))
               for c in (*_BASE, *config.colunas_gravaveis, *config.colunas_fonte, *config.chaves_extras)}
    if t is None:
        with autocommit() as t:
            return _gravar_ou_de_novo(t, tipo, valores, generos)
    return _gravar_ou_de_novo(t, tipo, valores, generos)


def _gravar_ou_de_novo(t: Transacao, tipo: str, valores: dict, generos: list[str]) -> dict:
    try:
        return _gravar(t, tipo, valores, generos)
    except Conflito:
        # Perdeu a corrida para outra importação da mesma chave, que já gravou:
        # de novo, agora ela é a Mídia existente e é atualizada.
        return _gravar(t, tipo, valores, generos)


def salvar_anime(dados: dict, generos: list[str], t: Transacao | None = None) -> dict:
    """Upsert do anime pelo `anilist_id`. Devolve `{'id_midia', 'ja_existia'}`."""
    return _salvar('anime', dados, generos, t)


def salvar_manga(dados: dict, generos: list[str], t: Transacao | None = None) -> dict:
    """Upsert do mangá pelo `anilist_id`. Devolve `{'id_midia', 'ja_existia'}`."""
    return _salvar('manga', dados, generos, t)


def salvar_jogo(dados: dict, generos: list[str], t: Transacao | None = None) -> dict:
    """Upsert do jogo pelo `rawg_slug` ou pelo `steam_appid`; `plataformas` é uma lista (text[])."""
    return _salvar('jogo', dados, generos, t)


#: Colunas de `relacoes_midia` que a Importação grava, com o tipo de cada uma.
_COLUNAS_RELACAO = {
    'id_midia': 'uuid', 'relacao': 'text', 'fonte': 'text', 'tipo_destino': 'text', 'destino_anilist_id': 'integer',
    'destino_rawg_slug': 'text', 'titulo': 'text', 'data_lancamento': 'date', 'adulto': 'boolean',
    'poster_url': 'text',
}

# O mesmo destino duas vezes na mesma Mídia: vale o primeiro (ON CONFLICT DO NOTHING).
_INSERIR_RELACOES = f"""
    INSERT INTO relacoes_midia ({', '.join(_COLUNAS_RELACAO)})
    SELECT {', '.join(_COLUNAS_RELACAO)} FROM jsonb_to_recordset(%s::jsonb)
        AS r({', '.join(f'{c} {t}' for c, t in _COLUNAS_RELACAO.items())})
    ON CONFLICT DO NOTHING
"""

_GRAVAR_CONTAGENS = """
    UPDATE jogos j SET game_series_count = c.contagem
    FROM jsonb_to_recordset(%s::jsonb) AS c(id_midia uuid, contagem integer)
    WHERE j.id_midia = c.id_midia
"""


def salvar_relacoes(t: Transacao, relacoes_por_midia: dict[str, list[dict]],
                    contagens_da_serie: dict[str, int] | None = None) -> None:
    """Troca as Relações das Mídias pelas dadas numa transação só (uma página da Importação).

    `relacoes_por_midia`: id_midia → Relações (`importacao.relacoes.da_obra`/`da_serie`). Mídia
    com lista vazia fica sem Relações. `contagens_da_serie`: id_midia → `game_series_count` dos
    jogos, gravada junto: se a gravação falha, nem as Relações nem a contagem mudam.
    """
    if not relacoes_por_midia:
        return
    linhas = [{**relacao, 'id_midia': id_midia}
              for id_midia, relacoes in relacoes_por_midia.items() for relacao in relacoes]
    contagens = [{'id_midia': i, 'contagem': c} for i, c in (contagens_da_serie or {}).items()]
    # Dois comandos, não um com o DELETE numa CTE: o INSERT do mesmo comando ainda veria a linha
    # apagada e, com ON CONFLICT DO NOTHING, a Relação igual à de antes sumiria.
    with t.bloco():
        if contagens:
            t.executar(_GRAVAR_CONTAGENS, (Jsonb(contagens),))
        t.executar('DELETE FROM relacoes_midia WHERE id_midia = ANY(%s::uuid[])', (list(relacoes_por_midia),))
        if linhas:
            t.executar(_INSERIR_RELACOES, (Jsonb(linhas),))
