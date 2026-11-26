"""
Atualizações de mídia e as Notificações que as entregam aos Usuários.

Publicar uma Atualização grava, na mesma transação, a Notificação de cada
Usuário que tem a Mídia na Lista pessoal num Rótulo ativo ou como favorita. A
publicação manual (admin) usa `ROTULOS_NOTIFICADOS`; a de episódio, do job de
episódios, `ROTULOS_DO_EPISODIO`. A Notificação de Notícia nasce em
`routes/noticias.py`; a lista e o "marcar todas" daqui cobrem as duas.
"""
from __future__ import annotations

import json
from typing import Any

from banco import consultar, executar, transacao

#: Rótulos de estado de quem recebe a Notificação, por Tipo de mídia.
ROTULOS_NOTIFICADOS = {
    'anime': ('assistindo', 'planejado'),
    'manga': ('lendo', 'planejado'),
    'jogo': ('jogando', 'na_fila', 'planejado'),
}

#: Rótulos de quem recebe a Atualização de episódio (além dos favoritos): a estreia avisa também
#: quem planeja assistir; os outros episódios, só quem está assistindo.
ROTULOS_DO_EPISODIO = {
    'estreia': ('assistindo', 'planejado'),
    'demais': ('assistindo',),
}


def _gravar(t, id_midia, tipo, titulo, descricao, dados_adicionais) -> str | None:
    """Grava a Atualização; `None` se ela já existia (o índice único de episódio)."""
    linha = t.consultar_um(
        """
        INSERT INTO atualizacoes_midia (id_midia, tipo_atualizacao, titulo, descricao, dados_adicionais)
        VALUES (%s, %s, %s, %s, %s::jsonb)
        ON CONFLICT DO NOTHING
        RETURNING id_atualizacao
        """,
        (id_midia, tipo, titulo, descricao, json.dumps(dados_adicionais)),
    )
    return linha and linha['id_atualizacao']


class Atualizacoes:
    def recentes(self, id_midia: str) -> list[dict[str, Any]]:
        """As 10 Atualizações mais recentes da Mídia."""
        return consultar(
            """
            SELECT a.id_midia, t.nome_tipo AS tipo_midia, a.tipo_atualizacao, a.titulo,
                   a.descricao, a.dados_adicionais, a.data_atualizacao
            FROM atualizacoes_midia a
            JOIN midias m ON m.id_midia = a.id_midia
            JOIN tipo_midia t ON t.id_tipo = m.id_tipo
            WHERE a.id_midia = %s
            ORDER BY a.data_atualizacao DESC, a.id_atualizacao DESC
            LIMIT 10
            """,
            (id_midia,),
        )

    def publicar(
        self, id_midia: str, tipo_midia: str, tipo: str, titulo: str,
        descricao: str | None = None, dados_adicionais: dict | None = None,
    ) -> int:
        """Grava a Atualização e as Notificações; devolve quantas Notificações saíram.

        É a publicação manual (admin). O episódio que já tem Atualização não se repete (índice
        único por Mídia e episódio): sai 0 Notificações.
        """
        rotulos = sorted(ROTULOS_NOTIFICADOS.get(tipo_midia, ('planejado',)))
        with transacao() as t:
            id_atualizacao = _gravar(t, id_midia, tipo, titulo, descricao, dados_adicionais or {})
            if id_atualizacao is None:
                return 0
            return t.executar(
                """
                INSERT INTO notificacoes (id_usuario, id_atualizacao)
                SELECT id_usuario, %s
                FROM lista_usuarios
                WHERE id_midia = %s AND (status_consumo = ANY(%s) OR favorito)
                """,
                (id_atualizacao, id_midia, rotulos),
            )

    def publicar_episodio(self, t, id_midia: str, episodio: int, titulo: str, exibido_em: str) -> list[str] | None:
        """Atualização `episodio` do job de episódios, na transação `t`; devolve quem a recebeu.

        A estreia (episódio 1) vai a quem tem o anime em Assistindo ou Planejado; os demais, só a
        Assistindo. Favorito recebe sempre. `None`: o episódio já tinha Atualização (nada muda).
        """
        rotulos = sorted(ROTULOS_DO_EPISODIO['estreia' if episodio == 1 else 'demais'])
        id_atualizacao = _gravar(
            t, id_midia, 'episodio', titulo, None, {'episodio': episodio, 'exibido_em': exibido_em},
        )
        if id_atualizacao is None:
            return None
        return [linha['id_usuario'] for linha in t.consultar(
            """
            INSERT INTO notificacoes (id_usuario, id_atualizacao)
            SELECT id_usuario, %s
            FROM lista_usuarios
            WHERE id_midia = %s AND (status_consumo = ANY(%s) OR favorito)
            RETURNING id_usuario
            """,
            (id_atualizacao, id_midia, rotulos),
        )]

    def notificacoes(self, id_usuario: str, apenas_nao_lidas: bool = False) -> list[dict[str, Any]]:
        """As 50 Notificações mais recentes do Usuário, de Atualização e de Notícia.

        Título, tipo e Mídia vêm da Atualização que a Notificação entrega; na de Notícia, o
        título é o da Notícia e os campos da Mídia saem nulos.
        """
        return consultar(
            """
            SELECT CASE WHEN n.id_noticia IS NULL THEN 'atualizacao' ELSE 'noticia' END AS origem,
                   n.id_noticia, a.id_midia, t.nome_tipo AS tipo_midia,
                   COALESCE(a.tipo_atualizacao, 'noticia') AS tipo,
                   COALESCE(a.titulo, nt.titulo) AS titulo,
                   COALESCE(NULLIF(m.titulo_portugues, ''), m.titulo_original) AS midia_nome,
                   CASE WHEN n.id_noticia IS NULL
                        THEN 'Novidade em ' || t.nome_tipo || ' da sua lista: '
                             || COALESCE(NULLIF(m.titulo_portugues, ''), m.titulo_original)
                        ELSE 'Nova Notícia no MediaList' END AS mensagem,
                   n.lida, n.data_criacao
            FROM notificacoes n
            LEFT JOIN noticias nt ON nt.id_noticia = n.id_noticia
            LEFT JOIN atualizacoes_midia a ON a.id_atualizacao = n.id_atualizacao
            LEFT JOIN midias m ON m.id_midia = a.id_midia
            LEFT JOIN tipo_midia t ON t.id_tipo = m.id_tipo
            WHERE n.id_usuario = %s AND (NOT %s OR NOT n.lida)
            ORDER BY n.data_criacao DESC, n.id_notificacao DESC
            LIMIT 50
            """,
            (id_usuario, apenas_nao_lidas),
        )

    def marcar_todas_lidas(self, id_usuario: str) -> int:
        """Marca as Notificações não lidas do Usuário; devolve quantas eram."""
        return executar('UPDATE notificacoes SET lida = true WHERE id_usuario = %s AND NOT lida', (id_usuario,))
