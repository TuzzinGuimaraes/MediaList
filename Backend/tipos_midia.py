"""
Tipo de mídia → tabela filha de `midias` e as colunas dela. Fonte única do mapa,
lida pelo Catálogo (`repositories.catalogo`, `repositories.itens_lista`) e pela
Importação (`importacao.db`).

Cada Mídia tem uma linha em `midias` (a parte comum) e uma na tabela filha do
seu Tipo (a parte específica: episódios, capítulos, plataformas).
"""
from __future__ import annotations

from typing import Any, NamedTuple

#: Colunas de `midias` que a API grava. A Nota média não está aqui: é calculada
#: das Avaliações (vw_notas_midia, ADR 0010). A Nota da fonte (`nota_fonte`)
#: também não: só a Importação a grava.
COLUNAS_BASE = (
    'titulo_original', 'titulo_ingles', 'titulo_portugues', 'sinopse',
    'data_lancamento', 'poster_url', 'banner_url',
)


class TipoMidia(NamedTuple):
    """Como um Tipo de mídia é guardado."""

    tabela: str  # tabela filha de `midias`
    apelido: str  # apelido da tabela filha nas consultas do Catálogo
    chave_fonte: str  # id na fonte externa, UNIQUE na filha: a Importação reimporta por ele
    origem_nota: str  # nome da fonte, rótulo da Nota da fonte
    colunas: tuple[str, ...]  # colunas próprias da filha, sem a chave da fonte
    coluna_status: str  # status da obra no Catálogo (em exibição, finalizado...)
    coluna_total: str | None  # total contra o qual o Progresso é medido; None: sem Progresso
    unidade_progresso: str
    aplicavel_a: list[str]  # `generos.aplicavel_a` de um gênero novo que a Importação cria

    @property
    def colunas_gravaveis(self) -> tuple[str, ...]:
        return (*self.colunas, self.chave_fonte)


# aplicavel_a: anime e mangá vêm do AniList e dividem gêneros, como no seed
# (Romance, Mecha, Isekai valem para '{anime,manga}'). Um gênero novo do AniList
# (Ecchi, Mahou Shoujo) não vale para jogo, senão aparece em /generos?tipo=jogo.
TIPOS: dict[str, TipoMidia] = {
    'anime': TipoMidia(
        tabela='animes', apelido='a', chave_fonte='anilist_id', origem_nota='AniList',
        colunas=('status_anime', 'numero_episodios', 'duracao_episodio', 'classificacao_etaria',
                 'trailer_url', 'estudio', 'fonte_original'),
        coluna_status='status_anime', coluna_total='numero_episodios', unidade_progresso='episodios',
        aplicavel_a=['anime', 'manga'],
    ),
    'manga': TipoMidia(
        tabela='mangas', apelido='ma', chave_fonte='anilist_id', origem_nota='AniList',
        colunas=('status_manga', 'numero_capitulos', 'numero_volumes', 'autor', 'artista',
                 'publicadora_original', 'revista', 'demografia'),
        coluna_status='status_manga', coluna_total='numero_capitulos', unidade_progresso='capitulos',
        aplicavel_a=['anime', 'manga'],
    ),
    'jogo': TipoMidia(
        tabela='jogos', apelido='j', chave_fonte='rawg_slug', origem_nota='RAWG',
        colunas=('desenvolvedor', 'publicadora', 'plataformas', 'status_jogo', 'modo_jogo',
                 'classificacao', 'trailer_url'),
        # Jogo não tem Progresso mensurável: horas não medem Progresso (CONTEXT.md).
        coluna_status='status_jogo', coluna_total=None, unidade_progresso='horas',
        aplicavel_a=['jogo'],
    ),
}


def valor_de_coluna(coluna: str, valor: Any) -> Any:
    """O valor como a coluna o guarda.

    `plataformas` é text[] no banco; a API a recebe como texto separado por
    vírgula ('PC, Switch') e a Importação como lista.
    """
    if coluna != 'plataformas':
        return valor
    if valor is None:
        return []
    if isinstance(valor, str):
        valor = valor.split(',')
    return [str(item).strip() for item in valor if str(item).strip()]


def joins_das_filhas(midia: str = 'm') -> str:
    """LEFT JOIN de todas as tabelas filhas, cada uma com o seu apelido."""
    return '\n'.join(
        f'LEFT JOIN {t.tabela} {t.apelido} ON {t.apelido}.id_midia = {midia}.id_midia' for t in TIPOS.values()
    )


def por_tipo(nome_tipo: str, expressao) -> str:
    """CASE sobre o nome do Tipo; `expressao(tipo)` dá o valor de cada um (None: fica de fora)."""
    ramos = [
        f"WHEN '{nome}' THEN {valor}" for nome, tipo in TIPOS.items() if (valor := expressao(tipo)) is not None
    ]
    return f"CASE {nome_tipo} {' '.join(ramos)} ELSE NULL END"


def origem_nota(nota_fonte: str) -> str:
    """SQL da origem da Nota da fonte, pela chave da fonte que a Mídia tem.

    Precisa das filhas no FROM (`joins_das_filhas`). Sem Nota da fonte não há
    origem: NULL.
    """
    ramos = ' '.join(
        f"WHEN {t.apelido}.{t.chave_fonte} IS NOT NULL THEN '{t.origem_nota}'" for t in TIPOS.values()
    )
    return f'CASE WHEN {nota_fonte} IS NULL THEN NULL {ramos} END'
