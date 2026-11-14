"""
Catálogo: busca, detalhe e gravação de Mídias.

A busca filtra, pagina e ordena; "mais bem avaliadas" ordena por
COALESCE(nota_media, nota_fonte) (ADR 0010). A Nota média e o Total de
avaliações vêm de `vw_notas_midia`, nunca de coluna gravada. Decimal e datas
ficam com o JSONProvider do app.
"""
from __future__ import annotations

import re
from typing import Any

from banco import consultar, consultar_um, executar, transacao
from schemas.estado_consumo import ESTADOS_TERMINAIS, ROTULOS_POR_TIPO
from tipos_midia import COLUNAS_BASE, TIPOS, joins_das_filhas, origem_nota, por_tipo, valor_de_coluna

_ROTULOS_TERMINAIS = sorted({
    rotulo for rotulos in ROTULOS_POR_TIPO.values()
    for estado, rotulo in rotulos.items() if estado in ESTADOS_TERMINAIS
})
if not all(re.fullmatch(r'[a-z_]+', rotulo) for rotulo in _ROTULOS_TERMINAIS):
    raise ValueError(f'Rótulo de estado fora de [a-z_]: {_ROTULOS_TERMINAIS}')

#: Rótulos de Concluído e Platinado de todos os Tipos, como lista SQL ('completo', 'lido', ...).
#: Constante do código (schemas/estado_consumo.py), nunca entrada do cliente: entra no
#: SELECT_MIDIA como literal, igual aos outros pedaços gerados aqui, para que quem usa o
#: SELECT (aqui e em itens_lista.py) não precise repassar um parâmetro. O ValueError acima
#: barra um rótulo que quebraria o literal.
SQL_ROTULOS_TERMINAIS = ', '.join(f"'{rotulo}'" for rotulo in _ROTULOS_TERMINAIS)

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
        a.duracao_episodio,
        a.classificacao_etaria,
        a.trailer_url AS anime_trailer_url,
        a.estudio,
        a.fonte_original,
        a.anilist_id AS anime_anilist_id,
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
    'titulo': 'COALESCE(m.titulo_portugues, m.titulo_original) ASC',
    'mais_adicionados': f'total_usuarios DESC, {NOTA_DE_RANKING}',
    'popularidade': f'total_usuarios DESC, {NOTA_DE_RANKING}',
    # Itens em Concluído ou Platinado (o Platinado também conta como Concluído).
    'mais_concluidos': f'total_concluidos DESC, {NOTA_DE_RANKING}',
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
        demografia, plataforma, desenvolvedor, modo_jogo, artista e ordem (ver ORDENS;
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
