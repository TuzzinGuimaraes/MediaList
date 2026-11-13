"""
Gravação da Importação no PostgreSQL (ticket 23), pelo módulo `banco`.

Cada Mídia é gravada numa transação: um único comando faz o upsert da base em
`midias` e da tabela filha do Tipo pela chave da fonte (`anilist_id` ou
`rawg_slug`), e depois vêm os gêneros. Reimportar atualiza a Mídia no lugar;
Avaliações e Itens não são tocados. A Nota média não é gravada: é calculada na
leitura (ticket 13); a Importação grava só a Nota da fonte (`nota_fonte`).

O mapa Tipo → tabela/colunas é o de `tipos_midia`, o mesmo do Catálogo.
"""
from __future__ import annotations

from banco import Conflito, transacao
from tipos_midia import COLUNAS_BASE, TIPOS, TipoMidia, valor_de_coluna

#: A Importação grava a base que a API grava mais a Nota da fonte.
_BASE = (*COLUNAS_BASE, 'nota_fonte')


def _marcadores(colunas) -> str:
    return ', '.join(f'%({c})s' for c in colunas)


def _atribuicoes(colunas) -> str:
    return ', '.join(f'{c} = %({c})s' for c in colunas)


def _upsert(config: TipoMidia) -> str:
    """Um comando: atualiza a Mídia que já tem a chave da fonte, ou cria base e filha.

    Devolve (id_midia, ja_existia). Duas importações da mesma chave ao mesmo
    tempo: as duas criam, e a segunda esbarra na UNIQUE da chave ao inserir a
    filha (Conflito); a transação dela é desfeita inteira, sem Mídia órfã.
    """
    tabela, chave, colunas = config.tabela, config.chave_fonte, config.colunas
    return f"""
        WITH existente AS (
            SELECT id_midia FROM {tabela} WHERE {chave} = %({chave})s
        ), base_atualizada AS (
            UPDATE midias SET {_atribuicoes(_BASE)}
            WHERE id_midia = (SELECT id_midia FROM existente)
            RETURNING id_midia
        ), filha_atualizada AS (
            UPDATE {tabela} SET {_atribuicoes(colunas)}
            WHERE id_midia = (SELECT id_midia FROM existente)
        ), criada AS (
            INSERT INTO midias (id_tipo, {', '.join(_BASE)})
            SELECT id_tipo, {_marcadores(_BASE)} FROM tipo_midia
            WHERE nome_tipo = %(tipo)s AND NOT EXISTS (SELECT 1 FROM existente)
            RETURNING id_midia
        ), filha_criada AS (
            INSERT INTO {tabela} (id_midia, {', '.join(config.colunas_gravaveis)})
            SELECT id_midia, {_marcadores(config.colunas_gravaveis)} FROM criada
            RETURNING id_midia
        )
        SELECT id_midia, true AS ja_existia FROM base_atualizada
        UNION ALL
        SELECT id_midia, false AS ja_existia FROM filha_criada
    """


def _gravar(tipo: str, valores: dict, generos: list[str]) -> dict:
    config = TIPOS[tipo]
    with transacao() as t:
        gravada = t.consultar_um(_upsert(config), {**valores, 'tipo': tipo})

        for nome in dict.fromkeys(g.strip() for g in generos if g and g.strip()):
            # Gênero que já existe ganha este Tipo no aplicavel_a, se ainda não tem.
            t.executar(
                'INSERT INTO generos (nome_genero, aplicavel_a) VALUES (%s, %s) '
                'ON CONFLICT (nome_genero) DO UPDATE SET aplicavel_a = ARRAY('
                'SELECT DISTINCT unnest(generos.aplicavel_a || EXCLUDED.aplicavel_a) ORDER BY 1) '
                'WHERE NOT generos.aplicavel_a @> EXCLUDED.aplicavel_a',
                (nome, config.aplicavel_a),
            )
            t.executar(
                'INSERT INTO midias_generos (id_midia, id_genero) '
                'SELECT %s, id_genero FROM generos WHERE nome_genero = %s '
                'ON CONFLICT DO NOTHING',
                (gravada['id_midia'], nome),
            )

    return {'id_midia': gravada['id_midia'], 'ja_existia': gravada['ja_existia']}


def _salvar(tipo: str, dados: dict, generos: list[str]) -> dict:
    config = TIPOS[tipo]
    if not dados.get(config.chave_fonte):
        raise ValueError(f'{tipo} sem {config.chave_fonte}: não há como reimportar sem duplicar')

    valores = {c: valor_de_coluna(c, dados.get(c)) for c in (*_BASE, *config.colunas_gravaveis)}
    try:
        return _gravar(tipo, valores, generos)
    except Conflito:
        # Perdeu a corrida para outra importação da mesma chave, que já gravou:
        # de novo, agora ela é a Mídia existente e é atualizada.
        return _gravar(tipo, valores, generos)


def salvar_anime(dados: dict, generos: list[str]) -> dict:
    """Upsert do anime pelo `anilist_id`. Devolve `{'id_midia', 'ja_existia'}`."""
    return _salvar('anime', dados, generos)


def salvar_manga(dados: dict, generos: list[str]) -> dict:
    """Upsert do mangá pelo `anilist_id`. Devolve `{'id_midia', 'ja_existia'}`."""
    return _salvar('manga', dados, generos)


def salvar_jogo(dados: dict, generos: list[str]) -> dict:
    """Upsert do jogo pelo `rawg_slug`; `plataformas` é uma lista (text[])."""
    return _salvar('jogo', dados, generos)
