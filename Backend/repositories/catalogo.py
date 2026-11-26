"""
Catálogo: busca, detalhe e gravação de Mídias.

A busca filtra, pagina e ordena; "mais bem avaliadas" ordena por
COALESCE(nota_media, nota_fonte) (ADR 0010). A Nota média e o Total de
avaliações vêm de `vw_notas_midia`, nunca de coluna gravada. Decimal e datas
ficam com o JSONProvider do app.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, get_args

from banco import consultar, consultar_um, executar, transacao
from repositories.rotulos import sql_rotulos
from schemas.estado_consumo import ESTADOS_TERMINAIS
from schemas.midias import Estacao
from tipos_midia import COLUNAS_BASE, TIPOS, joins_das_filhas, origem_nota, por_tipo, valor_de_coluna

#: Rótulos de Concluído e Platinado de todos os Tipos, como lista SQL ('completo', 'lido', ...).
#: Entra no SELECT_MIDIA como literal, igual aos outros pedaços gerados aqui, para que quem usa
#: o SELECT (aqui e em itens_lista.py) não precise repassar um parâmetro.
SQL_ROTULOS_TERMINAIS = sql_rotulos(*ESTADOS_TERMINAIS)

#: Estações na ordem do ano, como lista SQL, para ordenar Temporadas.
SQL_ESTACOES = ', '.join(f"'{e}'" for e in get_args(Estacao))

#: Instante ISO 8601 com fuso, como o job de episódios grava o `exibido_em` das Atualizações.
INSTANTE_ISO = r'^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}(:?\d{2})?)$'

#: Colunas de uma Mídia nas respostas da API. Os nomes duplicados (`id_anime`,
#: `codigo_anime`) e prefixados (`anime_trailer_url`) são contrato com os clientes.
SELECT_MIDIA = f"""
    SELECT
        m.id_midia,
        m.id_midia AS id_anime,
        m.codigo_midia,
        m.codigo_midia AS codigo_anime,
        tm.nome_tipo AS tipo,
        tm.label AS tipo_label,
        m.titulo_original,
        m.titulo_ingles,
        m.titulo_portugues,
        m.sinopse,
        m.data_lancamento,
        n.nota_media,
        n.total_avaliacoes,
        m.nota_fonte,
        {origem_nota('m.nota_fonte')} AS origem_nota,
        m.poster_url,
        m.banner_url,
        a.status_anime,
        a.numero_episodios,
        a.episodios_lancados,
        a.proximo_episodio_em,
        a.duracao_episodio,
        a.classificacao_etaria,
        a.trailer_url AS anime_trailer_url,
        a.estudio,
        a.fonte_original,
        a.anilist_id AS anime_anilist_id,
        a.temporada_estacao,
        a.temporada_ano,
        a.temporada_estimada,
        a.formato,
        ma.status_manga,
        ma.numero_capitulos,
        ma.numero_volumes,
        ma.autor,
        ma.artista AS manga_artista,
        ma.publicadora_original,
        ma.revista,
        ma.demografia,
        ma.anilist_id AS manga_anilist_id,
        j.desenvolvedor,
        j.publicadora,
        NULLIF(array_to_string(j.plataformas, ', '), '') AS plataformas,
        j.status_jogo,
        j.modo_jogo,
        j.classificacao,
        j.trailer_url AS jogo_trailer_url,
        j.rawg_slug,
        COALESCE(a.trailer_url, j.trailer_url) AS trailer_url,
        {por_tipo('tm.nome_tipo', lambda t: f'{t.apelido}.{t.coluna_status}')} AS status_catalogo,
        {por_tipo('tm.nome_tipo', lambda t: t.coluna_total and f'{t.apelido}.{t.coluna_total}')}
            AS progresso_total_padrao,
        {por_tipo('tm.nome_tipo', lambda t: f"'{t.unidade_progresso}'")} AS unidade_progresso,
        (
            SELECT string_agg(DISTINCT g.nome_genero, ', ' ORDER BY g.nome_genero)
            FROM midias_generos mg
            JOIN generos g ON g.id_genero = mg.id_genero
            WHERE mg.id_midia = m.id_midia
        ) AS generos,
        (
            SELECT COUNT(DISTINCT lu.id_usuario)
            FROM lista_usuarios lu
            WHERE lu.id_midia = m.id_midia
        ) AS total_usuarios,
        (
            SELECT COUNT(*)
            FROM lista_usuarios lu
            WHERE lu.id_midia = m.id_midia AND lu.status_consumo IN ({SQL_ROTULOS_TERMINAIS})
        ) AS total_concluidos
"""

FROM_MIDIA = f"""
    FROM midias m
    JOIN tipo_midia tm ON tm.id_tipo = m.id_tipo
    JOIN vw_notas_midia n ON n.id_midia = m.id_midia
    {joins_das_filhas('m')}
"""

#: "Mais bem avaliadas": a Nota média, ou a Nota da fonte quando ninguém
#: avaliou (ticket 13). Sem nenhuma das duas, a Mídia vai para o fim.
NOTA_DE_RANKING = 'COALESCE(n.nota_media, m.nota_fonte) DESC NULLS LAST'

#: Ordens aceitas em `buscar`; o id desempata, para a paginação não repetir nem pular Mídias.
ORDENS = {
    'nota_media': f'{NOTA_DE_RANKING}, total_usuarios DESC',
    'data_lancamento': 'm.data_lancamento DESC NULLS LAST',
    # A Temporada da estreia mais cedo para a mais tarde.
    'estreia': 'm.data_lancamento ASC NULLS LAST',
    'titulo': 'COALESCE(m.titulo_portugues, m.titulo_original) ASC',
    'mais_adicionados': f'total_usuarios DESC, {NOTA_DE_RANKING}',
    'popularidade': f'total_usuarios DESC, {NOTA_DE_RANKING}',
    # Itens em Concluído ou Platinado (o Platinado também conta como Concluído).
    'mais_concluidos': f'total_concluidos DESC, {NOTA_DE_RANKING}',
    # Os mais esperados: a Popularidade da fonte (a do AniList), não a do MediaList.
    'popularidade_fonte': f'a.popularidade_fonte DESC NULLS LAST, {NOTA_DE_RANKING}',
    # Só a Nota da fonte (a do AniList/RAWG), sem a Nota média (ADR 0010).
    'nota_fonte': 'm.nota_fonte DESC NULLS LAST',
}

#: Filtros de texto parcial, sem caixa: filtro -> coluna.
FILTROS_PARCIAIS = {
    'autor': 'ma.autor',
    'estudio': 'a.estudio',
    'desenvolvedor': 'j.desenvolvedor',
    'artista': 'ma.artista',
}
#: Filtros de valor exato: filtro -> coluna.
FILTROS_EXATOS = {
    'demografia': 'ma.demografia',
    'modo_jogo': 'j.modo_jogo',
}

#: Popularidade primeiro; a nota (Nota média, senão a da fonte) desempata.
POPULARES = f"""
    SELECT p.*, {origem_nota('p.nota_fonte')} AS origem_nota
    FROM vw_midias_populares p
    {joins_das_filhas('p')}
    WHERE %(tipo)s::text IS NULL OR p.tipo = %(tipo)s
    ORDER BY p.total_usuarios DESC, COALESCE(p.nota_media, p.nota_fonte) DESC NULLS LAST, p.id_midia
    LIMIT 20
"""


def com_generos_lista(linha: dict[str, Any]) -> dict[str, Any]:
    """A linha com `generos_lista`: os gêneros, que vêm em texto ('Ação, Drama'), como lista."""
    generos = linha.get('generos')
    return {**linha, 'generos_lista': [g.strip() for g in generos.split(',')] if generos else []}


def _filtros(tipo: str | None, filtros: dict[str, Any]) -> tuple[str, list[Any]]:
    clausulas: list[str] = []
    params: list[Any] = []

    if tipo:
        clausulas.append('tm.nome_tipo = %s')
        params.append(tipo)

    if filtros.get('busca'):
        clausulas.append('(m.titulo_portugues ILIKE %s OR m.titulo_original ILIKE %s OR m.sinopse ILIKE %s)')
        params.extend([f"%{filtros['busca']}%"] * 3)

    if filtros.get('genero'):
        clausulas.append("""
            EXISTS (
                SELECT 1
                FROM midias_generos mg2
                JOIN generos g2 ON g2.id_genero = mg2.id_genero
                WHERE mg2.id_midia = m.id_midia AND g2.nome_genero = %s
            )
        """)
        params.append(filtros['genero'])

    if filtros.get('status'):
        # Com Tipo, o status do Tipo; sem, o de qualquer um.
        colunas = [f'{t.apelido}.{t.coluna_status}' for nome, t in TIPOS.items() if not tipo or nome == tipo]
        clausulas.append('(' + ' OR '.join(f'{c} = %s' for c in colunas) + ')')
        params.extend([filtros['status']] * len(colunas))

    for filtro, coluna in FILTROS_PARCIAIS.items():
        if filtros.get(filtro):
            clausulas.append(f'{coluna} ILIKE %s')
            params.append(f'%{filtros[filtro]}%')

    for filtro, coluna in FILTROS_EXATOS.items():
        if filtros.get(filtro):
            clausulas.append(f'{coluna} = %s')
            params.append(filtros[filtro])

    # Ano de lançamento, inclusive nos dois extremos; Mídia sem data fica fora.
    if filtros.get('ano_min') is not None:
        clausulas.append('m.data_lancamento >= make_date(%s, 1, 1)')
        params.append(filtros['ano_min'])
    if filtros.get('ano_max') is not None:
        clausulas.append('m.data_lancamento < make_date(%s + 1, 1, 1)')
        params.append(filtros['ano_max'])

    # Temporada: só animes; a estação e o ano vão juntos (o schema da rota cobra).
    if filtros.get('temporada_estacao') and filtros.get('temporada_ano') is not None:
        clausulas.append('a.temporada_estacao = %s AND a.temporada_ano = %s')
        params.extend([filtros['temporada_estacao'], filtros['temporada_ano']])

    if filtros.get('plataforma'):
        # Elemento inteiro do text[] (índice GIN), não substring.
        clausulas.append('j.plataformas @> ARRAY[%s]::text[]')
        params.append(filtros['plataforma'])

    return (' WHERE ' + ' AND '.join(clausulas)) if clausulas else '', params


def _gravar_generos(t, id_midia: str, generos: list[int] | None, substituir: bool) -> None:
    if generos is None:
        return
    if substituir:
        t.executar('DELETE FROM midias_generos WHERE id_midia = %s', (id_midia,))
    for id_genero in generos:
        t.executar(
            'INSERT INTO midias_generos (id_midia, id_genero) VALUES (%s, %s) ON CONFLICT DO NOTHING',
            (id_midia, id_genero),
        )


class Catalogo:
    """As Mídias do sistema. Uma instância não guarda estado: só fala com o banco."""

    def buscar(
        self, tipo: str | None = None, pagina: int = 1, limite: int = 20, filtros: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """Uma página de Mídias. `filtros`: busca, genero, status, autor, estudio,
        demografia, plataforma, desenvolvedor, modo_jogo, artista, ano_min, ano_max, temporada_estacao com
        temporada_ano e ordem (ver ORDENS;
        desconhecida ou ausente vale 'nota_media')."""
        filtros = filtros or {}
        where, params = _filtros(tipo, filtros)
        ordem = ORDENS.get(filtros.get('ordem') or 'nota_media', ORDENS['nota_media'])
        linhas = consultar(
            f'{SELECT_MIDIA} {FROM_MIDIA} {where} ORDER BY {ordem}, m.id_midia LIMIT %s OFFSET %s',
            (*params, limite, max(pagina - 1, 0) * limite),
        )
        return [com_generos_lista(linha) for linha in linhas]

    def contar(self, tipo: str | None = None, filtros: dict[str, Any] | None = None) -> int:
        """Quantas Mídias `buscar` acharia com o Tipo e os filtros, em todas as páginas."""
        where, params = _filtros(tipo, filtros or {})
        return consultar_um(f'SELECT count(*) AS total {FROM_MIDIA} {where}', params)['total']

    def obter(self, id_midia: str) -> dict[str, Any] | None:
        """A Mídia completa, ou None se não existe. Id que não é uuid levanta Integridade (400)."""
        linha = consultar_um(f'{SELECT_MIDIA} {FROM_MIDIA} WHERE m.id_midia = %s', (id_midia,))
        return com_generos_lista(linha) if linha else None

    def populares(self, tipo: str | None = None) -> list[dict[str, Any]]:
        """As 20 Mídias com mais Usuários (Popularidade), de um Tipo ou de todos."""
        return consultar(POPULARES, {'tipo': tipo or None})

    def distribuicao(self, id_midia: str) -> list[dict[str, Any]]:
        """Quantos Itens de lista a Mídia tem em cada Rótulo de estado."""
        return consultar(
            """
            SELECT status_consumo, count(*) AS total
            FROM lista_usuarios
            WHERE id_midia = %s
            GROUP BY status_consumo
            ORDER BY total DESC, status_consumo
            """,
            (id_midia,),
        )

    def atividade(self, id_midia: str) -> dict[str, Any]:
        """Atividade da Mídia por dia nas últimas 52 semanas (364 dias, o último é hoje):
        adições à Lista, Avaliações e conclusões. Só os dias com atividade, em ordem.
        Hoje e o dia de um instante seguem o fuso da sessão do banco."""
        janela = consultar_um('SELECT CURRENT_DATE - 363 AS inicio, CURRENT_DATE AS fim')
        dias = consultar(
            """
            SELECT dia AS data, count(*) AS total
            FROM (
                SELECT data_adicao::date AS dia FROM lista_usuarios WHERE id_midia = %(id)s
                UNION ALL
                SELECT data_conclusao FROM lista_usuarios WHERE id_midia = %(id)s
                UNION ALL
                SELECT data_avaliacao::date FROM avaliacoes WHERE id_midia = %(id)s
            ) eventos
            WHERE dia BETWEEN %(inicio)s AND %(fim)s
            GROUP BY dia
            ORDER BY dia
            """,
            {'id': id_midia, **janela},
        )
        return {**janela, 'dias': dias}

    def facetas(self, tipo: str | None = None) -> dict[str, Any]:
        """Plataformas (jogos) e estúdios (animes) distintos, em ordem, e a Temporada mais antiga
        dos animes; vazios (ou nula) fora do Tipo."""
        plataformas = estudios = []
        temporada_mais_antiga = None
        if tipo in (None, 'jogo'):
            plataformas = [
                linha['valor'] for linha in consultar(
                    "SELECT DISTINCT p AS valor FROM jogos, unnest(plataformas) AS p WHERE p <> '' ORDER BY p"
                )
            ]
        if tipo in (None, 'anime'):
            estudios = [
                linha['valor'] for linha in consultar(
                    "SELECT DISTINCT estudio AS valor FROM animes WHERE estudio <> '' ORDER BY estudio"
                )
            ]
            temporada_mais_antiga = consultar_um(
                f'SELECT temporada_estacao AS estacao, temporada_ano AS ano FROM animes '
                f'WHERE temporada_ano = (SELECT min(temporada_ano) FROM animes) '
                f'ORDER BY array_position(ARRAY[{SQL_ESTACOES}], temporada_estacao) LIMIT 1'
            )
        return {'plataformas': plataformas, 'estudios': estudios, 'temporada_mais_antiga': temporada_mais_antiga}

    def calendario(self, de: datetime, ate: datetime) -> list[dict[str, Any]]:
        """Episódios de anime com o instante em [de, ate): os exibidos (Atualizações `episodio`) e
        os próximos (`proximo_episodio_em`, episódio `episodios_lancados + 1`). O episódio com
        Atualização e ainda apontado como próximo sai uma vez, como exibido. Pelo instante."""
        return consultar(
            """
            SELECT m.id_midia, 'anime' AS tipo, m.titulo_original, m.titulo_ingles, m.titulo_portugues,
                   m.poster_url, e.episodio, e.instante, e.exibido
            FROM (
                SELECT DISTINCT ON (id_midia, episodio) id_midia, episodio, instante, exibido
                FROM (
                    SELECT id_midia, episodio, instante, true AS exibido
                    FROM (
                        -- A Atualização `episodio` do admin pode vir fora do formato do job: fica de fora.
                        SELECT id_midia,
                               CASE WHEN dados_adicionais->>'episodio' ~ '^[1-9][0-9]{0,8}$'
                                    THEN (dados_adicionais->>'episodio')::int END AS episodio,
                               CASE WHEN dados_adicionais->>'exibido_em' ~ %(instante_iso)s
                                    THEN (dados_adicionais->>'exibido_em')::timestamptz END AS instante
                        FROM atualizacoes_midia
                        WHERE tipo_atualizacao = 'episodio'
                    ) atualizacoes
                    WHERE episodio IS NOT NULL AND instante >= %(de)s AND instante < %(ate)s
                    UNION ALL
                    SELECT id_midia, COALESCE(episodios_lancados, 0) + 1, proximo_episodio_em, false
                    FROM animes
                    WHERE proximo_episodio_em >= %(de)s AND proximo_episodio_em < %(ate)s
                ) episodios
                ORDER BY id_midia, episodio, exibido DESC
            ) e
            JOIN midias m ON m.id_midia = e.id_midia
            -- Só anime: a Atualização `episodio` de outro Tipo fica de fora.
            WHERE EXISTS (SELECT 1 FROM animes a WHERE a.id_midia = e.id_midia)
            ORDER BY e.instante, m.id_midia, e.episodio
            """,
            {'de': de, 'ate': ate, 'instante_iso': INSTANTE_ISO},
        )

    def generos(self, tipo: str | None = None) -> list[dict[str, Any]]:
        """Gêneros, todos ou os que se aplicam ao Tipo (elemento inteiro de `aplicavel_a`)."""
        if tipo:
            return consultar(
                'SELECT * FROM generos WHERE aplicavel_a @> ARRAY[%s]::text[] ORDER BY nome_genero', (tipo,)
            )
        return consultar('SELECT * FROM generos ORDER BY nome_genero')

    def criar(self, tipo: str, dados: dict[str, Any]) -> str:
        """Grava a Mídia (base, filha do Tipo e gêneros por id) e devolve o id_midia."""
        config = TIPOS[tipo]
        base = [c for c in COLUNAS_BASE if c in dados]
        filha = [c for c in config.colunas_gravaveis if c in dados]

        with transacao() as t:
            id_midia = t.consultar_um(
                f"INSERT INTO midias (id_tipo, {', '.join(base)}) "
                f"VALUES ((SELECT id_tipo FROM tipo_midia WHERE nome_tipo = %s){', %s' * len(base)}) "
                'RETURNING id_midia',
                (tipo, *(dados[c] for c in base)),
            )['id_midia']
            t.executar(
                f"INSERT INTO {config.tabela} (id_midia{''.join(f', {c}' for c in filha)}) "
                f"VALUES (%s{', %s' * len(filha)})",
                (id_midia, *(valor_de_coluna(c, dados[c]) for c in filha)),
            )
            _gravar_generos(t, id_midia, dados.get('generos'), substituir=False)
        return id_midia

    def atualizar(self, id_midia: str, dados: dict[str, Any]) -> bool:
        """Grava os campos enviados; `generos` presente substitui os gêneros. False se a Mídia não existe."""
        existente = consultar_um(
            'SELECT tm.nome_tipo FROM midias m JOIN tipo_midia tm ON tm.id_tipo = m.id_tipo WHERE m.id_midia = %s',
            (id_midia,),
        )
        if not existente:
            return False

        config = TIPOS[existente['nome_tipo']]
        base = [c for c in COLUNAS_BASE if c in dados]
        filha = [c for c in config.colunas_gravaveis if c in dados]
        with transacao() as t:
            if base:
                t.executar(
                    f"UPDATE midias SET {', '.join(f'{c} = %s' for c in base)} WHERE id_midia = %s",
                    (*(dados[c] for c in base), id_midia),
                )
            if filha:
                t.executar(
                    f"UPDATE {config.tabela} SET {', '.join(f'{c} = %s' for c in filha)} WHERE id_midia = %s",
                    (*(valor_de_coluna(c, dados[c]) for c in filha), id_midia),
                )
            _gravar_generos(t, id_midia, dados.get('generos'), substituir=True)
        return True

    def apagar(self, id_midia: str) -> bool:
        """Apaga a Mídia (e, em cascata, o que é dela). False se não existia."""
        return executar('DELETE FROM midias WHERE id_midia = %s', (id_midia,)) > 0
