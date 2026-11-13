"""
Repositórios para acesso a mídias e listas.
"""
from __future__ import annotations

from typing import Any

from banco import consultar, executar, transacao


def _serialize_row(row: dict[str, Any] | None) -> dict[str, Any] | None:
    """Acrescenta `generos_lista`. Decimal e datas ficam com o JSONProvider do app."""
    if not row:
        return None

    serialized = dict(row)
    generos = serialized.get('generos')
    serialized['generos_lista'] = [genero.strip() for genero in generos.split(',')] if generos else []
    return serialized


def _como_lista_de_plataformas(valor: Any) -> list[str]:
    """`plataformas` chega como texto separado por vírgula (contrato da API) e é text[] no banco."""
    if valor is None:
        return []
    if isinstance(valor, str):
        valor = valor.split(',')
    return [str(item).strip() for item in valor if str(item).strip()]


def _chave_alfabetica(item: dict[str, Any]) -> tuple[str, str]:
    """Título exibido (mesma regra do `tituloDaMidia` do app e do web) sem caixa, e o id_lista."""
    titulo = item.get('titulo_portugues') or item.get('titulo_original') or ''
    return titulo.casefold(), str(item.get('id_lista') or '')


class MidiaRepository:
    """Operações base de consulta e manutenção de mídias."""

    BASE_SELECT = """
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
            CASE tm.nome_tipo
                WHEN 'anime' THEN a.status_anime
                WHEN 'manga' THEN ma.status_manga
                WHEN 'jogo' THEN j.status_jogo
                ELSE NULL
            END AS status_catalogo,
            CASE tm.nome_tipo
                WHEN 'anime' THEN a.numero_episodios
                WHEN 'manga' THEN ma.numero_capitulos
                ELSE NULL
            END AS progresso_total_padrao,
            CASE tm.nome_tipo
                WHEN 'anime' THEN 'episodios'
                WHEN 'manga' THEN 'capitulos'
                WHEN 'jogo' THEN 'horas'
                ELSE NULL
            END AS unidade_progresso,
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
            ) AS total_usuarios
    """

    BASE_FROM = """
        FROM midias m
        JOIN tipo_midia tm ON tm.id_tipo = m.id_tipo
        JOIN vw_notas_midia n ON n.id_midia = m.id_midia
        LEFT JOIN animes a ON a.id_midia = m.id_midia
        LEFT JOIN mangas ma ON ma.id_midia = m.id_midia
        LEFT JOIN jogos j ON j.id_midia = m.id_midia
    """

    #: Colunas de `midias` que a API grava. A Nota média não está aqui: ela é
    #: calculada das Avaliações (vw_notas_midia), e a Nota da fonte é do ticket 13.
    BASE_FIELDS = {
        'titulo_original': 'titulo_original',
        'titulo_ingles': 'titulo_ingles',
        'titulo_portugues': 'titulo_portugues',
        'sinopse': 'sinopse',
        'data_lancamento': 'data_lancamento',
        'poster_url': 'poster_url',
        'banner_url': 'banner_url',
    }

    TYPE_CONFIG = {
        'anime': {
            'table': 'animes',
            'fields': {
                'status_anime': 'status_anime',
                'numero_episodios': 'numero_episodios',
                'duracao_episodio': 'duracao_episodio',
                'classificacao_etaria': 'classificacao_etaria',
                'trailer_url': 'trailer_url',
                'estudio': 'estudio',
                'fonte_original': 'fonte_original',
                'anilist_id': 'anilist_id',
            },
        },
        'manga': {
            'table': 'mangas',
            'fields': {
                'status_manga': 'status_manga',
                'numero_capitulos': 'numero_capitulos',
                'numero_volumes': 'numero_volumes',
                'autor': 'autor',
                'artista': 'artista',
                'publicadora_original': 'publicadora_original',
                'revista': 'revista',
                'demografia': 'demografia',
                'anilist_id': 'anilist_id',
            },
        },
        'jogo': {
            'table': 'jogos',
            'fields': {
                'desenvolvedor': 'desenvolvedor',
                'publicadora': 'publicadora',
                'plataformas': 'plataformas',
                'status_jogo': 'status_jogo',
                'modo_jogo': 'modo_jogo',
                'classificacao': 'classificacao',
                'trailer_url': 'trailer_url',
                'rawg_slug': 'rawg_slug',
            },
        },
    }

    def _fetch_all(self, query: str, params: tuple[Any, ...] | list[Any] | None = None) -> list[dict[str, Any]]:
        return [_serialize_row(row) for row in consultar(query, params)]

    def _fetch_one(self, query: str, params: tuple[Any, ...] | list[Any] | None = None) -> dict[str, Any] | None:
        results = self._fetch_all(query, params)
        return results[0] if results else None

    def _execute(self, query: str, params: tuple[Any, ...] | list[Any] | None = None) -> int:
        """Executa um comando e devolve quantas linhas ele afetou."""
        return executar(query, params)

    def _build_filters(self, tipo: str | None, filtros: dict[str, Any] | None) -> tuple[str, list[Any]]:
        filtros = filtros or {}
        clauses = []
        params: list[Any] = []

        if tipo:
            clauses.append("tm.nome_tipo = %s")
            params.append(tipo)

        if filtros.get('busca'):
            termo = f"%{filtros['busca']}%"
            clauses.append("(m.titulo_portugues ILIKE %s OR m.titulo_original ILIKE %s OR m.sinopse ILIKE %s)")
            params.extend([termo, termo, termo])

        if filtros.get('genero'):
            clauses.append("""
                EXISTS (
                    SELECT 1
                    FROM midias_generos mg2
                    JOIN generos g2 ON g2.id_genero = mg2.id_genero
                    WHERE mg2.id_midia = m.id_midia AND g2.nome_genero = %s
                )
            """)
            params.append(filtros['genero'])

        status = filtros.get('status')
        if status:
            if tipo == 'anime':
                clauses.append("a.status_anime = %s")
            elif tipo == 'manga':
                clauses.append("ma.status_manga = %s")
            elif tipo == 'jogo':
                clauses.append("j.status_jogo = %s")
            else:
                clauses.append("""
                    (
                        a.status_anime = %s
                        OR ma.status_manga = %s
                        OR j.status_jogo = %s
                    )
                """)
                params.extend([status, status, status])
                status = None
            if status is not None:
                params.append(status)

        if filtros.get('autor'):
            clauses.append("ma.autor ILIKE %s")
            params.append(f"%{filtros['autor']}%")

        if filtros.get('estudio'):
            clauses.append("a.estudio ILIKE %s")
            params.append(f"%{filtros['estudio']}%")

        if filtros.get('demografia'):
            clauses.append("ma.demografia = %s")
            params.append(filtros['demografia'])

        if filtros.get('plataforma'):
            # Elemento inteiro do text[] (índice GIN), não substring.
            clauses.append("j.plataformas @> ARRAY[%s]::text[]")
            params.append(filtros['plataforma'])

        if filtros.get('desenvolvedor'):
            clauses.append("j.desenvolvedor ILIKE %s")
            params.append(f"%{filtros['desenvolvedor']}%")

        if filtros.get('modo_jogo'):
            clauses.append("j.modo_jogo = %s")
            params.append(filtros['modo_jogo'])

        if filtros.get('artista'):
            clauses.append("ma.artista ILIKE %s")
            params.append(f"%{filtros['artista']}%")

        return (" WHERE " + " AND ".join(clauses)) if clauses else "", params

    def _order_clause(self, ordem: str | None) -> str:
        # Sem Avaliações a Nota média é NULL e vai para o fim. A regra de "mais
        # bem avaliadas" com a Nota da fonte é do ticket 13. O id desempata,
        # para a paginação não repetir nem pular Mídias.
        order_by = {
            'nota_media': 'n.nota_media DESC NULLS LAST, total_usuarios DESC',
            'data_lancamento': 'm.data_lancamento DESC NULLS LAST',
            'titulo': 'COALESCE(m.titulo_portugues, m.titulo_original) ASC',
            'mais_adicionados': 'total_usuarios DESC, n.nota_media DESC NULLS LAST',
            'popularidade': 'total_usuarios DESC, n.nota_media DESC NULLS LAST',
        }
        return f" ORDER BY {order_by.get(ordem or 'nota_media', order_by['nota_media'])}, m.id_midia"

    def buscar_por_tipo(
        self, tipo: str | None, pagina: int = 1, limite: int = 20, filtros: dict[str, Any] | None = None
    ) -> list[dict[str, Any]]:
        where_clause, params = self._build_filters(tipo, filtros)
        offset = max(pagina - 1, 0) * limite
        query = f"""
            {self.BASE_SELECT}
            {self.BASE_FROM}
            {where_clause}
            {self._order_clause((filtros or {}).get('ordem'))}
            LIMIT %s OFFSET %s
        """
        params.extend([limite, offset])
        return self._fetch_all(query, params)

    def buscar_por_id(self, id_midia: str, expected_type: str | None = None) -> dict[str, Any] | None:
        where_clause = " WHERE m.id_midia = %s"
        params: list[Any] = [id_midia]
        if expected_type:
            where_clause += " AND tm.nome_tipo = %s"
            params.append(expected_type)

        query = f"""
            {self.BASE_SELECT}
            {self.BASE_FROM}
            {where_clause}
        """
        return self._fetch_one(query, params)

    def buscar_por_titulo(self, termo: str, tipo: str | None = None) -> list[dict[str, Any]]:
        return self.buscar_por_tipo(tipo, pagina=1, limite=50, filtros={'busca': termo, 'ordem': 'titulo'})

    def _valor_de_coluna(self, column: str, valor: Any) -> Any:
        return _como_lista_de_plataformas(valor) if column == 'plataformas' else valor

    def _gravar_generos(self, t, id_midia: str, generos: list[int] | None, replace: bool = False) -> None:
        if generos is None:
            return

        if replace:
            t.executar("DELETE FROM midias_generos WHERE id_midia = %s", (id_midia,))

        for genero_id in generos:
            t.executar(
                "INSERT INTO midias_generos (id_midia, id_genero) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                (id_midia, genero_id),
            )

    def inserir_midia_base(self, tipo: str, dados: dict[str, Any]) -> str:
        config = self.TYPE_CONFIG[tipo]

        base_columns = ['id_tipo']
        base_params: list[Any] = [tipo]
        for field, column in self.BASE_FIELDS.items():
            if field in dados:
                base_columns.append(column)
                base_params.append(dados[field])

        valores = ['(SELECT id_tipo FROM tipo_midia WHERE nome_tipo = %s)'] + ['%s'] * (len(base_columns) - 1)

        with transacao() as t:
            criada = t.consultar_um(
                f"INSERT INTO midias ({', '.join(base_columns)}) VALUES ({', '.join(valores)}) RETURNING id_midia",
                tuple(base_params),
            )
            id_midia = criada['id_midia']

            child_columns = ['id_midia']
            child_params: list[Any] = [id_midia]
            for field, column in config['fields'].items():
                if field in dados:
                    child_columns.append(column)
                    child_params.append(self._valor_de_coluna(column, dados[field]))

            t.executar(
                f"INSERT INTO {config['table']} ({', '.join(child_columns)}) "
                f"VALUES ({', '.join(['%s'] * len(child_columns))})",
                tuple(child_params),
            )
            self._gravar_generos(t, id_midia, dados.get('generos'))
            return id_midia

    def atualizar_midia_base(self, id_midia: str, dados: dict[str, Any]) -> bool:
        existente = self.buscar_por_id(id_midia)
        if not existente:
            return False

        tipo = existente['tipo']
        config = self.TYPE_CONFIG[tipo]

        base_updates = []
        base_params: list[Any] = []
        for field, column in self.BASE_FIELDS.items():
            if field in dados:
                base_updates.append(f"{column} = %s")
                base_params.append(dados[field])

        child_updates = []
        child_params: list[Any] = []
        for field, column in config['fields'].items():
            if field in dados:
                child_updates.append(f"{column} = %s")
                child_params.append(self._valor_de_coluna(column, dados[field]))

        with transacao() as t:
            if base_updates:
                t.executar(
                    f"UPDATE midias SET {', '.join(base_updates)} WHERE id_midia = %s",
                    (*base_params, id_midia),
                )
            if child_updates:
                t.executar(
                    f"UPDATE {config['table']} SET {', '.join(child_updates)} WHERE id_midia = %s",
                    (*child_params, id_midia),
                )
            self._gravar_generos(t, id_midia, dados.get('generos'), replace='generos' in dados)
        return True

    def deletar_midia(self, id_midia: str) -> bool:
        return self._execute("DELETE FROM midias WHERE id_midia = %s", (id_midia,)) > 0

    def obter_avaliacoes(self, id_midia: str) -> list[dict[str, Any]]:
        query = """
            SELECT
                av.*,
                u.nome_completo,
                u.foto_perfil
            FROM avaliacoes av
            JOIN usuarios u ON u.id_usuario = av.id_usuario
            WHERE av.id_midia = %s
            ORDER BY av.data_avaliacao DESC
        """
        return self._fetch_all(query, (id_midia,))


class AnimeRepository(MidiaRepository):
    def inserir_anime(self, dados_base: dict[str, Any], dados_anime: dict[str, Any]) -> str:
        return self.inserir_midia_base('anime', {**dados_base, **dados_anime})

    def atualizar_anime(self, id_midia: str, dados: dict[str, Any]) -> bool:
        return self.atualizar_midia_base(id_midia, dados)

    def buscar_anime_completo(self, id_midia: str) -> dict[str, Any] | None:
        return self.buscar_por_id(id_midia, expected_type='anime')


class MangaRepository(MidiaRepository):
    def inserir_manga(self, dados_base: dict[str, Any], dados_manga: dict[str, Any]) -> str:
        return self.inserir_midia_base('manga', {**dados_base, **dados_manga})

    def atualizar_manga(self, id_midia: str, dados: dict[str, Any]) -> bool:
        return self.atualizar_midia_base(id_midia, dados)

    def buscar_manga_completo(self, id_midia: str) -> dict[str, Any] | None:
        return self.buscar_por_id(id_midia, expected_type='manga')

    def buscar_por_autor(self, autor: str) -> list[dict[str, Any]]:
        return self.buscar_por_tipo('manga', pagina=1, limite=50, filtros={'autor': autor, 'ordem': 'titulo'})

    def buscar_por_demografia(self, demografia: str) -> list[dict[str, Any]]:
        return self.buscar_por_tipo('manga', pagina=1, limite=50, filtros={'demografia': demografia})


class JogoRepository(MidiaRepository):
    def inserir_jogo(self, dados_base: dict[str, Any], dados_jogo: dict[str, Any]) -> str:
        return self.inserir_midia_base('jogo', {**dados_base, **dados_jogo})

    def atualizar_jogo(self, id_midia: str, dados: dict[str, Any]) -> bool:
        return self.atualizar_midia_base(id_midia, dados)

    def buscar_jogo_completo(self, id_midia: str) -> dict[str, Any] | None:
        return self.buscar_por_id(id_midia, expected_type='jogo')

    def buscar_por_plataforma(self, plataforma: str) -> list[dict[str, Any]]:
        return self.buscar_por_tipo('jogo', pagina=1, limite=50, filtros={'plataforma': plataforma})


#: Total da Mídia que o Item copia ao ser criado (antes, o trigger
#: `before_insert_lista`): episódios do anime, capítulos do mangá, NULL no jogo.
TOTAL_DA_MIDIA = """
    SELECT COALESCE(a.numero_episodios, ma.numero_capitulos)
    FROM midias m
    LEFT JOIN animes a ON a.id_midia = m.id_midia
    LEFT JOIN mangas ma ON ma.id_midia = m.id_midia
    WHERE m.id_midia = %s
"""


class ListaRepository(MidiaRepository):
    """CRUD dos itens da lista do usuário.

    As regras do Item de lista vivem em `dominio.lista_pessoal`; aqui só há
    persistência. `id_lista` vem do banco (uuidv7); `progresso_total` é copiado
    da Mídia na criação, pela própria aplicação.
    """

    #: Colunas de `lista_usuarios` que a aplicação grava, na ordem do UPDATE.
    #: `progresso_total` não está aqui: o total pertence à Mídia, e no Item ele é
    #: a cópia gravada em `criar_item`.
    COLUNAS_GRAVAVEIS = (
        'status_consumo',
        'progresso_atual',
        'nota_usuario',
        'favorito',
        'comentario',
        'data_inicio',
        'data_conclusao',
        'total_rewatches',
        'privado',
    )

    #: Campos booleanos, que chegam do JSON como 0/1 com frequência.
    CAMPOS_BOOLEANOS = frozenset({'favorito', 'privado'})

    def obter_lista_usuario(
        self, id_usuario: str, tipo: str | None = None, status: str | None = None
    ) -> list[dict[str, Any]]:
        query = f"""
            {self.BASE_SELECT},
            lu.id_lista,
            lu.codigo_lista,
            lu.status_consumo,
            lu.status_consumo AS status_visualizacao,
            lu.progresso_atual,
            lu.progresso_atual AS episodios_assistidos,
            lu.progresso_total,
            lu.nota_usuario,
            lu.favorito,
            lu.data_inicio,
            lu.data_conclusao,
            lu.comentario,
            lu.total_rewatches,
            lu.privado,
            lu.data_adicao,
            lu.data_atualizacao
            {self.BASE_FROM}
            JOIN lista_usuarios lu ON lu.id_midia = m.id_midia
            WHERE lu.id_usuario = %s
        """
        params: list[Any] = [id_usuario]

        if tipo:
            query += " AND tm.nome_tipo = %s"
            params.append(tipo)

        if status:
            query += " AND lu.status_consumo = %s"
            params.append(status)

        # Ordem alfabética do título que os clientes exibem (português, senão o
        # original), sem caixa, com o id_lista desempatando: editar um Item não o
        # tira do lugar. Feita aqui, e não no SQL, para não depender da collation.
        return sorted(self._fetch_all(query, params), key=_chave_alfabetica)

    def criar_item(self, id_usuario: str, id_midia: str, campos: dict[str, Any]) -> str | None:
        """Insere o Item e devolve o `id_lista`, ou None se já existia.

        A unique key (usuário, mídia) é o que garante uma Mídia por Usuário:
        `ON CONFLICT DO NOTHING` sem linha devolvida é o Item já existente.
        """
        colunas = ['id_usuario', 'id_midia', 'progresso_total']
        valores = ['%s', '%s', f'({TOTAL_DA_MIDIA})']
        params: list[Any] = [id_usuario, id_midia, id_midia]
        for campo in self.COLUNAS_GRAVAVEIS:
            if campo not in campos or campos[campo] is None:
                continue
            colunas.append(campo)
            valores.append('%s')
            params.append(self._valor_de(campo, campos[campo]))

        with transacao() as t:
            criado = t.consultar_um(
                f"INSERT INTO lista_usuarios ({', '.join(colunas)}) VALUES ({', '.join(valores)}) "
                "ON CONFLICT (id_usuario, id_midia) DO NOTHING RETURNING id_lista",
                tuple(params),
            )
        return criado['id_lista'] if criado else None

    def atualizar_campos(self, id_lista: str, campos: dict[str, Any]) -> bool:
        """Grava os campos num Item. False quando não havia nada a gravar."""
        fields = []
        params = []

        for campo in self.COLUNAS_GRAVAVEIS:
            if campo not in campos:
                continue

            if campo == 'nota_usuario' and campos[campo] in (None, ''):
                fields.append("nota_usuario = NULL")
                continue

            fields.append(f"{campo} = %s")
            params.append(self._valor_de(campo, campos[campo]))

        if not fields:
            return False

        # data_atualizacao fica com o trigger do banco.
        params.append(id_lista)
        executar(
            f"UPDATE lista_usuarios SET {', '.join(fields)} WHERE id_lista = %s",
            tuple(params),
        )
        return True

    def _valor_de(self, campo: str, valor: Any) -> Any:
        return bool(valor) if campo in self.CAMPOS_BOOLEANOS else valor

    def remover_item(self, id_lista: str, id_usuario: str) -> bool:
        """Apaga o Item do usuário e diz se alguma linha saiu."""
        return self._execute(
            "DELETE FROM lista_usuarios WHERE id_lista = %s AND id_usuario = %s",
            (id_lista, id_usuario),
        ) > 0

    def obter_item_por_id(self, id_lista: str) -> dict[str, Any] | None:
        """Item de lista com o tipo e o total da Mídia, para dono e validação.

        `progresso_total_padrao` vem da Mídia, não da coluna denormalizada do
        Item: é ele que decide a promoção a Concluído.
        """
        return self._fetch_one(
            """
            SELECT lu.id_lista,
                   lu.id_usuario,
                   lu.id_midia,
                   lu.status_consumo,
                   lu.progresso_atual,
                   lu.progresso_total,
                   lu.data_conclusao,
                   lu.total_rewatches,
                   tm.nome_tipo AS tipo,
                   CASE tm.nome_tipo
                       WHEN 'anime' THEN a.numero_episodios
                       WHEN 'manga' THEN ma.numero_capitulos
                       ELSE NULL
                   END AS progresso_total_padrao
            FROM lista_usuarios lu
            JOIN midias m ON m.id_midia = lu.id_midia
            JOIN tipo_midia tm ON tm.id_tipo = m.id_tipo
            LEFT JOIN animes a ON a.id_midia = m.id_midia
            LEFT JOIN mangas ma ON ma.id_midia = m.id_midia
            WHERE lu.id_lista = %s
            """,
            (id_lista,),
        )

    def obter_item_usuario(self, id_usuario: str, id_midia: str) -> dict[str, Any] | None:
        return self._fetch_one(
            """
            SELECT id_lista, id_usuario, id_midia
            FROM lista_usuarios
            WHERE id_usuario = %s AND id_midia = %s
            """,
            (id_usuario, id_midia),
        )
