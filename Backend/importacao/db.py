"""
Gravação da Importação no PostgreSQL (ticket 23), pelo módulo `banco`.

Cada Mídia é gravada numa transação: a base em `midias`, a tabela filha do
Tipo com upsert pela chave da fonte (`anilist_id` ou `rawg_slug`) e os gêneros.
Reimportar atualiza a Mídia no lugar; Avaliações e Itens não são tocados. A
Nota média não é gravada: é calculada na leitura (ticket 13); a Importação
grava só a Nota da fonte (`nota_fonte`).
"""
from __future__ import annotations

from typing import NamedTuple

from banco import Transacao, transacao

_BASE = (
    'titulo_original', 'titulo_ingles', 'titulo_portugues', 'sinopse',
    'data_lancamento', 'nota_fonte', 'poster_url', 'banner_url',
)

class _Tipo(NamedTuple):
    """Como cada Tipo de mídia é gravado."""

    tabela: str  # tabela filha de `midias`
    chave: str  # chave da fonte, UNIQUE na filha: o upsert é por ela
    colunas: tuple[str, ...]  # colunas próprias da filha
    aplicavel_a: list[str]  # `generos.aplicavel_a` de um gênero que a Importação cria


# aplicavel_a: anime e mangá vêm do AniList e dividem gêneros, como no seed
# (Romance, Mecha, Isekai valem para '{anime,manga}'). Um gênero novo do AniList
# (Ecchi, Mahou Shoujo) não vale para jogo, senão aparece em /generos?tipo=jogo.
# Se outro Tipo passar a usar um gênero que já existe, o tipo entra no
# aplicavel_a dele (ver o ON CONFLICT em _salvar).
_TIPOS = {
    'anime': _Tipo(
        tabela='animes', chave='anilist_id',
        colunas=('status_anime', 'numero_episodios', 'duracao_episodio', 'classificacao_etaria',
                 'trailer_url', 'estudio', 'fonte_original'),
        aplicavel_a=['anime', 'manga'],
    ),
    'manga': _Tipo(
        tabela='mangas', chave='anilist_id',
        colunas=('status_manga', 'numero_capitulos', 'numero_volumes', 'autor', 'artista',
                 'publicadora_original', 'revista', 'demografia'),
        aplicavel_a=['anime', 'manga'],
    ),
    'jogo': _Tipo(
        tabela='jogos', chave='rawg_slug',
        colunas=('desenvolvedor', 'publicadora', 'plataformas', 'status_jogo', 'modo_jogo',
                 'classificacao', 'trailer_url'),
        aplicavel_a=['jogo'],
    ),
}


def _marcadores(colunas) -> str:
    return ', '.join(f'%({c})s' for c in colunas)


def _atualizar_base(t: Transacao, id_midia: str, valores: dict) -> None:
    t.executar(
        f"UPDATE midias SET {', '.join(f'{c} = %({c})s' for c in _BASE)} WHERE id_midia = %(id_midia)s",
        {**valores, 'id_midia': id_midia},
    )


def _salvar(tipo: str, dados: dict, generos: list[str]) -> dict:
    config = _TIPOS[tipo]
    tabela, chave, colunas = config.tabela, config.chave, config.colunas
    if not dados.get(chave):
        raise ValueError(f'{tipo} sem {chave}: não há como reimportar sem duplicar')

    valores = {c: dados.get(c) for c in (*_BASE, *colunas, chave)}
    if tipo == 'jogo':
        valores['plataformas'] = list(valores['plataformas'] or [])

    with transacao() as t:
        existente = t.consultar_um(
            f'SELECT id_midia FROM {tabela} WHERE {chave} = %(chave)s', {'chave': valores[chave]}
        )
        ja_existia = existente is not None
        if ja_existia:
            id_midia = existente['id_midia']
            _atualizar_base(t, id_midia, valores)
        else:
            id_midia = t.consultar_um(
                f"INSERT INTO midias (id_tipo, {', '.join(_BASE)}) "
                f"VALUES ((SELECT id_tipo FROM tipo_midia WHERE nome_tipo = %(tipo)s), {_marcadores(_BASE)}) "
                'RETURNING id_midia',
                {**valores, 'tipo': tipo},
            )['id_midia']

        colunas_filha = (*colunas, chave)
        gravado = t.consultar_um(
            f"INSERT INTO {tabela} (id_midia, {', '.join(colunas_filha)}) "
            f'VALUES (%(id_midia)s, {_marcadores(colunas_filha)}) '
            f"ON CONFLICT ({chave}) DO UPDATE SET {', '.join(f'{c} = EXCLUDED.{c}' for c in colunas)} "
            'RETURNING id_midia',
            {**valores, 'id_midia': id_midia},
        )['id_midia']
        if gravado != id_midia:
            # Outra importação gravou a mesma chave entre o SELECT e o INSERT:
            # fica a Mídia dela, atualizada; a que acabamos de criar sai.
            t.executar('DELETE FROM midias WHERE id_midia = %s', (id_midia,))
            _atualizar_base(t, gravado, valores)
            ja_existia = True

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
                (gravado, nome),
            )

    return {'id_midia': gravado, 'ja_existia': ja_existia}


def salvar_anime(dados: dict, generos: list[str]) -> dict:
    """Upsert do anime pelo `anilist_id`. Devolve `{'id_midia', 'ja_existia'}`."""
    return _salvar('anime', dados, generos)


def salvar_manga(dados: dict, generos: list[str]) -> dict:
    """Upsert do mangá pelo `anilist_id`. Devolve `{'id_midia', 'ja_existia'}`."""
    return _salvar('manga', dados, generos)


def salvar_jogo(dados: dict, generos: list[str]) -> dict:
    """Upsert do jogo pelo `rawg_slug`; `plataformas` é uma lista (text[])."""
    return _salvar('jogo', dados, generos)
