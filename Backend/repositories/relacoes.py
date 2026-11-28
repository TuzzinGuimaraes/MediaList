"""
Relações de uma Mídia (`relacoes_midia`): as dela e as das outras Mídias que apontam para ela.

O destino de uma Relação é a identidade na fonte (Tipo e `anilist_id` ou `rawg_slug`), que casa
com o Catálogo aqui, na leitura. O inverso, o filtro e o lado que vale ficam em
`dominio.relacoes`.
"""
from __future__ import annotations

from typing import Any

from banco import consultar, consultar_um
from repositories.catalogo import obra_adulta
from repositories.titulos import titulo_exibido

#: Tipo e identidade na fonte da Mídia; nulo se ela não existe.
_MIDIA = """
    SELECT tm.nome_tipo AS tipo, COALESCE(a.anilist_id, ma.anilist_id) AS anilist_id, j.rawg_slug
    FROM midias m
    JOIN tipo_midia tm ON tm.id_tipo = m.id_tipo
    LEFT JOIN animes a ON a.id_midia = m.id_midia
    LEFT JOIN mangas ma ON ma.id_midia = m.id_midia
    LEFT JOIN jogos j ON j.id_midia = m.id_midia
    WHERE m.id_midia = %s
"""

#: As Relações da Mídia, com a obra de destino no Catálogo (se estiver) e o Estado de consumo do
#: Usuário nela. Do Catálogo saem título, pôster e estreia; sem ela, o que a fonte deu.
_PROPRIAS = f"""
    SELECT r.relacao, r.tipo_destino AS tipo, r.destino_anilist_id AS anilist_id,
           r.destino_rawg_slug AS rawg_slug, r.adulto, d.id_midia,
           COALESCE({titulo_exibido('d')}, r.titulo) AS titulo,
           COALESCE(d.poster_url, r.poster_url) AS poster_url,
           COALESCE(d.data_lancamento, r.data_lancamento) AS data_lancamento,
           lu.status_consumo
    FROM relacoes_midia r
    LEFT JOIN animes da ON r.tipo_destino = 'anime' AND da.anilist_id = r.destino_anilist_id
    LEFT JOIN mangas dm ON r.tipo_destino = 'manga' AND dm.anilist_id = r.destino_anilist_id
    LEFT JOIN jogos dj ON r.tipo_destino = 'jogo' AND dj.rawg_slug = r.destino_rawg_slug
    LEFT JOIN midias d ON d.id_midia = COALESCE(da.id_midia, dm.id_midia, dj.id_midia)
    LEFT JOIN lista_usuarios lu ON lu.id_midia = d.id_midia AND lu.id_usuario = %(usuario)s::uuid
    WHERE r.id_midia = %(midia)s
"""

#: As Relações das outras Mídias do Catálogo que apontam para esta, com o código gravado na
#: origem. A origem é adulta pelo que a Importação gravou nela (`obra_adulta`).
_DE_OUTRAS = f"""
    SELECT r.relacao, tm.nome_tipo AS tipo, COALESCE(a.anilist_id, ma.anilist_id) AS anilist_id,
           j.rawg_slug, o.id_midia, {titulo_exibido('o')} AS titulo,
           o.poster_url, o.data_lancamento, lu.status_consumo,
           {obra_adulta(anime='a', manga='ma', jogo='j')} AS adulto
    FROM relacoes_midia r
    JOIN midias o ON o.id_midia = r.id_midia
    JOIN tipo_midia tm ON tm.id_tipo = o.id_tipo
    LEFT JOIN animes a ON a.id_midia = o.id_midia
    LEFT JOIN mangas ma ON ma.id_midia = o.id_midia
    LEFT JOIN jogos j ON j.id_midia = o.id_midia
    LEFT JOIN lista_usuarios lu ON lu.id_midia = o.id_midia AND lu.id_usuario = %(usuario)s::uuid
    WHERE r.tipo_destino = %(tipo)s AND r.id_midia <> %(midia)s
      AND (r.destino_anilist_id = %(anilist_id)s OR r.destino_rawg_slug = %(rawg_slug)s)
"""


Linhas = list[dict[str, Any]]


class Relacoes:
    """Leitura das Relações gravadas pela Importação."""

    def da_midia(self, id_midia: str, id_usuario: str | None) -> tuple[Linhas, Linhas] | None:
        """(as da Mídia, as das outras que apontam para ela), ou None se a Mídia não existe.

        Id que não é uuid levanta Integridade (400).
        """
        midia = consultar_um(_MIDIA, (id_midia,))
        if midia is None:
            return None
        params = {'midia': id_midia, 'usuario': id_usuario, **midia}
        proprias = consultar(_PROPRIAS, params)
        if midia['anilist_id'] is None and midia['rawg_slug'] is None:
            return proprias, []
        return proprias, consultar(_DE_OUTRAS, params)
