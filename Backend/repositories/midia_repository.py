"""
Repositórios para acesso a mídias e listas.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from database import call_procedure, get_db_connection


def _serialize_value(value: Any) -> Any:
    """Converte tipos do MySQL para valores compatíveis com JSON."""
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def _serialize_row(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if not row:
        return None

    serialized = {key: _serialize_value(value) for key, value in row.items()}
    generos = serialized.get('generos')
    serialized['generos_lista'] = [genero.strip() for genero in generos.split(',')] if generos else []
    return serialized


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
            m.nota_media,
            m.total_avaliacoes,
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
            j.plataformas,
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
                SELECT GROUP_CONCAT(DISTINCT g.nome_genero ORDER BY g.nome_genero SEPARATOR ', ')
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
        LEFT JOIN animes a ON a.id_midia = m.id_midia
        LEFT JOIN mangas ma ON ma.id_midia = m.id_midia
        LEFT JOIN jogos j ON j.id_midia = m.id_midia
    """

    BASE_FIELDS = {
        'titulo_original': 'titulo_original',
        'titulo_ingles': 'titulo_ingles',
        'titulo_portugues': 'titulo_portugues',
        'sinopse': 'sinopse',
        'data_lancamento': 'data_lancamento',
        'nota_media': 'nota_media',
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
        connection = get_db_connection()
        if not connection:
            raise RuntimeError('Erro ao conectar ao banco')

        try:
            cursor = connection.cursor(dictionary=True)
            cursor.execute(query, params or ())
            rows = cursor.fetchall()
            cursor.close()
            return [_serialize_row(row) for row in rows]
        finally:
            connection.close()

    def _fetch_one(self, query: str, params: tuple[Any, ...] | list[Any] | None = None) -> dict[str, Any] | None:
        results = self._fetch_all(query, params)
        return results[0] if results else None

    def _execute(self, query: str, params: tuple[Any, ...] | list[Any] | None = None) -> None:
        connection = get_db_connection()
        if not connection:
            raise RuntimeError('Erro ao conectar ao banco')

        try:
            cursor = connection.cursor()
            cursor.execute(query, params or ())
            connection.commit()
            cursor.close()
        finally:
            connection.close()

    def _build_filters(self, tipo: str | None, filtros: dict[str, Any] | None) -> tuple[str, list[Any]]:
        filtros = filtros or {}
        clauses = []
        params: list[Any] = []

        if tipo:
            clauses.append("tm.nome_tipo = %s")
            params.append(tipo)

        if filtros.get('busca'):
            termo = f"%{filtros['busca']}%"
            clauses.append("(m.titulo_portugues LIKE %s OR m.titulo_original LIKE %s OR m.sinopse LIKE %s)")
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
            clauses.append("ma.autor LIKE %s")
            params.append(f"%{filtros['autor']}%")

        if filtros.get('estudio'):
            clauses.append("a.estudio LIKE %s")
            params.append(f"%{filtros['estudio']}%")

        if filtros.get('demografia'):
            clauses.append("ma.demografia = %s")
            params.append(filtros['demografia'])

        if filtros.get('plataforma'):
            clauses.append("j.plataformas LIKE %s")
            params.append(f"%{filtros['plataforma']}%")

        if filtros.get('desenvolvedor'):
            clauses.append("j.desenvolvedor LIKE %s")
            params.append(f"%{filtros['desenvolvedor']}%")

        if filtros.get('modo_jogo'):
            clauses.append("j.modo_jogo = %s")
            params.append(filtros['modo_jogo'])

        if filtros.get('artista'):
            clauses.append("ma.artista LIKE %s")
            params.append(f"%{filtros['artista']}%")

        return (" WHERE " + " AND ".join(clauses)) if clauses else "", params

    def _order_clause(self, ordem: str | None) -> str:
        order_by = {
            'nota_media': 'm.nota_media DESC, total_usuarios DESC',
            'data_lancamento': 'm.data_lancamento DESC',
            'titulo': 'COALESCE(m.titulo_portugues, m.titulo_original) ASC',
            'mais_adicionados': 'total_usuarios DESC, m.nota_media DESC',
            'popularidade': 'total_usuarios DESC, m.nota_media DESC',
        }
        return f" ORDER BY {order_by.get(ordem or 'nota_media', order_by['nota_media'])}"

    def buscar_por_tipo(self, tipo: str | None, pagina: int = 1, limite: int = 20, filtros: dict[str, Any] | None = None) -> list[dict[str, Any]]:
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

    def _get_tipo_id(self, cursor, tipo: str) -> int:
        cursor.execute("SELECT id_tipo FROM tipo_midia WHERE nome_tipo = %s", (tipo,))
        row = cursor.fetchone()
        if not row:
            raise ValueError('Tipo de mídia inválido')
        return row[0]

    def _insert_generos(self, cursor, id_midia: str, generos: list[int] | None, replace: bool = False) -> None:
        if generos is None:
            return

        if replace:
            cursor.execute("DELETE FROM midias_generos WHERE id_midia = %s", (id_midia,))

        for genero_id in generos:
            cursor.execute(
                "INSERT IGNORE INTO midias_generos (id_midia, id_genero) VALUES (%s, %s)",
                (id_midia, genero_id),
            )

    def inserir_midia_base(self, tipo: str, dados: dict[str, Any]) -> str:
        connection = get_db_connection()
        if not connection:
            raise RuntimeError('Erro ao conectar ao banco')

        config = self.TYPE_CONFIG[tipo]

        try:
            cursor = connection.cursor()
            id_tipo = self._get_tipo_id(cursor, tipo)

            base_columns = []
            base_values = []
            base_params = []
            for field, column in self.BASE_FIELDS.items():
                if field in dados:
                    base_columns.append(column)
                    base_values.append("%s")
                    base_params.append(dados[field])

            base_columns.insert(0, 'id_tipo')
            base_values.insert(0, '%s')
            base_params.insert(0, id_tipo)

            cursor.execute(
                f"INSERT INTO midias ({', '.join(base_columns)}) VALUES ({', '.join(base_values)})",
                tuple(base_params),
            )

            cursor.execute(
                """
                SELECT id_midia
                FROM midias
                WHERE id_tipo = %s AND titulo_original = %s
                ORDER BY data_criacao DESC
                LIMIT 1
                """,
                (id_tipo, dados['titulo_original']),
            )
            row = cursor.fetchone()
            if not row:
                raise RuntimeError('Falha ao recuperar mídia criada')

            id_midia = row[0]

            child_columns = ['id_midia']
            child_values = ['%s']
            child_params = [id_midia]
            for field, column in config['fields'].items():
                if field in dados:
                    child_columns.append(column)
                    child_values.append('%s')
                    child_params.append(dados[field])

            cursor.execute(
                f"INSERT INTO {config['table']} ({', '.join(child_columns)}) VALUES ({', '.join(child_values)})",
                tuple(child_params),
            )
            self._insert_generos(cursor, id_midia, dados.get('generos'))
            connection.commit()
            cursor.close()
            return id_midia
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def atualizar_midia_base(self, id_midia: str, dados: dict[str, Any]) -> bool:
        existente = self.buscar_por_id(id_midia)
        if not existente:
            return False

        connection = get_db_connection()
        if not connection:
            raise RuntimeError('Erro ao conectar ao banco')

        tipo = existente['tipo']
        config = self.TYPE_CONFIG[tipo]

        try:
            cursor = connection.cursor()

            base_updates = []
            base_params = []
            for field, column in self.BASE_FIELDS.items():
                if field in dados:
                    base_updates.append(f"{column} = %s")
                    base_params.append(dados[field])

            if base_updates:
                base_params.append(id_midia)
                cursor.execute(
                    f"UPDATE midias SET {', '.join(base_updates)} WHERE id_midia = %s",
                    tuple(base_params),
                )

            child_updates = []
            child_params = []
            for field, column in config['fields'].items():
                if field in dados:
                    child_updates.append(f"{column} = %s")
                    child_params.append(dados[field])

            if child_updates:
                child_params.append(id_midia)
                cursor.execute(
                    f"UPDATE {config['table']} SET {', '.join(child_updates)} WHERE id_midia = %s",
                    tuple(child_params),
                )

            self._insert_generos(cursor, id_midia, dados.get('generos'), replace=True if 'generos' in dados else False)
            connection.commit()
            cursor.close()
            return True
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def deletar_midia(self, id_midia: str) -> bool:
        if not self.buscar_por_id(id_midia):
            return False
        self._execute("DELETE FROM midias WHERE id_midia = %s", (id_midia,))
        return True

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


class ListaRepository(MidiaRepository):
    """Operações da lista do usuário."""

    def obter_lista_usuario(self, id_usuario: str, tipo: str | None = None, status: str | None = None) -> list[dict[str, Any]]:
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

        query += " ORDER BY lu.data_atualizacao DESC"
        return self._fetch_all(query, params)

    def adicionar_midia(self, id_usuario: str, id_midia: str, status: str) -> list[dict[str, Any]] | None:
        return call_procedure('adicionar_midia_lista', [id_usuario, id_midia, status])

    def atualizar_progresso(self, id_lista: str, progresso: int, status: str) -> list[dict[str, Any]] | None:
        return call_procedure('atualizar_progresso_midia', [id_lista, progresso, status])

    def atualizar_item(self, id_lista: str, dados: dict[str, Any]) -> bool:
        connection = get_db_connection()
        if not connection:
            raise RuntimeError('Erro ao conectar ao banco')

        try:
            cursor = connection.cursor()
            fields = []
            params = []

            update_map = {
                'status_consumo': 'status_consumo',
                'nota_usuario': 'nota_usuario',
                'favorito': 'favorito',
                'comentario': 'comentario',
                'data_inicio': 'data_inicio',
                'data_conclusao': 'data_conclusao',
                'total_rewatches': 'total_rewatches',
                'privado': 'privado',
                'progresso_total': 'progresso_total',
            }

            for field, column in update_map.items():
                if field not in dados:
                    continue

                if field == 'nota_usuario' and dados[field] in (None, ''):
                    fields.append("nota_usuario = NULL")
                    continue

                value = bool(dados[field]) if field in {'favorito', 'privado'} else dados[field]
                fields.append(f"{column} = %s")
                params.append(value)

            if not fields:
                return False

            fields.append("data_atualizacao = NOW()")
            params.append(id_lista)
            cursor.execute(
                f"UPDATE lista_usuarios SET {', '.join(fields)} WHERE id_lista = %s",
                tuple(params),
            )
            connection.commit()
            cursor.close()
            return cursor.rowcount >= 0
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def remover_item(self, id_lista: str, id_usuario: str) -> bool:
        self._execute("DELETE FROM lista_usuarios WHERE id_lista = %s AND id_usuario = %s", (id_lista, id_usuario))
        return True

    def obter_owner(self, id_lista: str) -> str | None:
        row = self._fetch_one("SELECT id_usuario FROM lista_usuarios WHERE id_lista = %s", (id_lista,))
        return row['id_usuario'] if row else None

    def obter_item_usuario(self, id_usuario: str, id_midia: str) -> dict[str, Any] | None:
        return self._fetch_one(
            """
            SELECT id_lista, id_usuario, id_midia
            FROM lista_usuarios
            WHERE id_usuario = %s AND id_midia = %s
            """,
            (id_usuario, id_midia),
        )
