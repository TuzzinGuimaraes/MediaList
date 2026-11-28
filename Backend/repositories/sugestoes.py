"""
Leitura das Sugestões (spec `sugestoes`): as recomendações que partem das sementes do Usuário e o
Em alta que completa a faixa.

A obra recomendada (`recomendacoes_midia`) casa com o Catálogo aqui, pelo `anilist_id`, como nas
Relações. As exclusões também ficam aqui: obra na Lista do Usuário em qualquer Estado, adulta (pela
fonte ou pelo Catálogo), fora do Catálogo e ligada a uma semente por uma Relação, nos dois sentidos.
Os pontos, o motivo e a ordem ficam em `dominio.sugestoes`.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Any

from banco import consultar
from repositories.catalogo import FROM_MIDIA, ORDENS, SELECT_MIDIA, com_generos_lista
from repositories.titulos import titulo_exibido

#: Anime adulto no Catálogo (`classificacao_etaria` 18, o `isAdult` do AniList) ou mangá `adulto`.
_ADULTA = "(a.classificacao_etaria = '18' OR ma.adulto) IS TRUE"

#: As recomendações das sementes do Usuário para as obras do Catálogo que podem virar Sugestão.
_RECOMENDACOES = f"""
    WITH sementes AS (
        SELECT lu.id_midia, lu.nota_usuario AS nota, lu.favorito, {titulo_exibido('m')} AS titulo,
               tm.nome_tipo AS tipo, COALESCE(a.anilist_id, ma.anilist_id) AS anilist_id
        FROM lista_usuarios lu
        JOIN midias m ON m.id_midia = lu.id_midia
        JOIN tipo_midia tm ON tm.id_tipo = m.id_tipo
        LEFT JOIN animes a ON a.id_midia = m.id_midia
        LEFT JOIN mangas ma ON ma.id_midia = m.id_midia
        WHERE lu.id_usuario = %(usuario)s::uuid AND tm.nome_tipo IN ('anime', 'manga')
          AND (lu.nota_usuario >= %(nota_minima)s OR lu.favorito)
    )
    SELECT d.id_midia, r.rating, a.popularidade_fonte AS popularidade, {titulo_exibido('d')} AS titulo,
           s.nota, s.favorito, s.titulo AS titulo_semente
    FROM sementes s
    JOIN recomendacoes_midia r ON r.id_midia = s.id_midia
    LEFT JOIN animes a ON r.tipo_destino = 'anime' AND a.anilist_id = r.destino_anilist_id
    LEFT JOIN mangas ma ON r.tipo_destino = 'manga' AND ma.anilist_id = r.destino_anilist_id
    JOIN midias d ON d.id_midia = COALESCE(a.id_midia, ma.id_midia)
    WHERE r.tipo_destino = ANY(%(tipos)s) AND NOT r.adulto AND NOT {_ADULTA}
      AND NOT EXISTS (
          SELECT 1 FROM lista_usuarios l WHERE l.id_usuario = %(usuario)s::uuid AND l.id_midia = d.id_midia
      )
      AND NOT EXISTS (
          SELECT 1
          FROM relacoes_midia rel
          JOIN sementes s2 ON (
              rel.id_midia = s2.id_midia
              AND rel.tipo_destino = r.tipo_destino AND rel.destino_anilist_id = r.destino_anilist_id
          ) OR (
              rel.id_midia = d.id_midia AND rel.tipo_destino = s2.tipo AND rel.destino_anilist_id = s2.anilist_id
          )
      )
"""

#: O Em alta do recorte, como `GET /midias/trending` (`nota_media`), sem o que está na Lista do
#: Usuário, sem adulta e sem as Mídias de `sem`.
_EM_ALTA = f"""
    {SELECT_MIDIA} {FROM_MIDIA}
    WHERE tm.nome_tipo = ANY(%(tipos)s) AND NOT {_ADULTA} AND m.id_midia <> ALL(%(sem)s::uuid[])
      AND NOT EXISTS (
          SELECT 1 FROM lista_usuarios l WHERE l.id_usuario = %(usuario)s::uuid AND l.id_midia = m.id_midia
      )
    ORDER BY {ORDENS['nota_media']}, m.id_midia
    LIMIT %(limite)s
"""

Linhas = list[dict[str, Any]]


class Sugestoes:
    """Leitura do que vira Sugestão. Uma instância não guarda estado: só fala com o banco."""

    def recomendacoes(self, id_usuario: str, tipos: list[str], nota_minima: Decimal) -> Linhas:
        """Cada recomendação de uma semente (Item de anime ou mangá com Nota pessoal ≥ `nota_minima`
        ou Favorito) para uma obra dos `tipos` que pode virar Sugestão, com a semente de origem."""
        return consultar(_RECOMENDACOES, {'usuario': id_usuario, 'tipos': tipos, 'nota_minima': nota_minima})

    def midias(self, ids: list[str]) -> dict[str, dict[str, Any]]:
        """As Mídias dos `ids`, como no Catálogo, pelo id."""
        if not ids:
            return {}
        linhas = consultar(f'{SELECT_MIDIA} {FROM_MIDIA} WHERE m.id_midia = ANY(%s::uuid[])', (ids,))
        return {str(linha['id_midia']): com_generos_lista(linha) for linha in linhas}

    def em_alta(self, id_usuario: str, tipos: list[str], sem: list[str], limite: int) -> Linhas:
        """Até `limite` Mídias do Em alta dos `tipos`, fora da Lista do Usuário e de `sem`."""
        return [com_generos_lista(linha) for linha in consultar(
            _EM_ALTA, {'usuario': id_usuario, 'tipos': tipos, 'sem': sem, 'limite': limite},
        )]
