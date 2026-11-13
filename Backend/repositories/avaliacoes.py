"""
Gravação e leitura das Avaliações. A regra (dono, uma por Mídia, escala) está
em `dominio.avaliacao`; aqui só há persistência.

Quem grava recebe de volta a Nota média e o Total de avaliações da Mídia lidos
na mesma transação (vw_notas_midia): a média é calculada, nunca gravada (ADR 0010).
"""
from __future__ import annotations

from typing import Any

from banco import consultar, consultar_um, executar, transacao

NOTAS_DA_MIDIA = 'SELECT nota_media, total_avaliacoes FROM vw_notas_midia WHERE id_midia = %s'

#: Campos de uma Avaliação que o autor pode editar.
CAMPOS_EDITAVEIS = ('nota', 'titulo_avaliacao', 'texto_avaliacao')


class AvaliacaoRepository:
    def listar(self, id_midia: str) -> list[dict[str, Any]]:
        """As Avaliações da Mídia, com nome e foto do autor, mais recentes primeiro."""
        linhas = consultar(
            """
            SELECT av.*, u.nome_completo, u.foto_perfil
            FROM avaliacoes av
            JOIN usuarios u ON u.id_usuario = av.id_usuario
            WHERE av.id_midia = %s
            ORDER BY av.data_avaliacao DESC
            """,
            (id_midia,),
        )
        # `generos_lista` vazio: a resposta sempre o trouxe (herança do serializador das Mídias).
        return [{**linha, 'generos_lista': []} for linha in linhas]

    def criar(
        self, id_usuario: str, id_midia: str, nota: float, titulo: str | None, texto: str | None,
    ) -> dict[str, Any]:
        """Grava a Avaliação; devolve `id_avaliacao`, `nota_media` e `total_avaliacoes`.

        Levanta `banco.Conflito` se o Usuário já avaliou a Mídia: quem decide é a
        UNIQUE (id_usuario, id_midia), sem SELECT antes, então dois POSTs ao mesmo
        tempo também caem nela.
        """
        with transacao() as t:
            criada = t.consultar_um(
                """
                INSERT INTO avaliacoes (id_usuario, id_midia, nota, titulo_avaliacao, texto_avaliacao)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id_avaliacao
                """,
                (id_usuario, id_midia, nota, titulo, texto),
            )
            notas = t.consultar_um(NOTAS_DA_MIDIA, (id_midia,)) or {}
        return {'id_avaliacao': criada['id_avaliacao'], **_notas(notas)}

    def obter(self, id_avaliacao: str) -> dict[str, Any] | None:
        """Autor e Mídia da Avaliação, ou None."""
        return consultar_um('SELECT id_usuario, id_midia FROM avaliacoes WHERE id_avaliacao = %s', (id_avaliacao,))

    def atualizar(self, id_avaliacao: str, id_midia: str, campos: dict[str, Any]) -> dict[str, Any]:
        """Grava os campos editáveis presentes e marca a edição; devolve as notas da Mídia."""
        gravados = [c for c in CAMPOS_EDITAVEIS if c in campos]
        with transacao() as t:
            t.executar(
                f"UPDATE avaliacoes SET {''.join(f'{c} = %s, ' for c in gravados)}data_edicao = now() "
                'WHERE id_avaliacao = %s',
                (*(campos[c] for c in gravados), id_avaliacao),
            )
            notas = t.consultar_um(NOTAS_DA_MIDIA, (id_midia,)) or {}
        return _notas(notas)

    def apagar(self, id_avaliacao: str) -> bool:
        return executar('DELETE FROM avaliacoes WHERE id_avaliacao = %s', (id_avaliacao,)) > 0


def _notas(linha: dict[str, Any]) -> dict[str, Any]:
    return {'nota_media': linha.get('nota_media'), 'total_avaliacoes': linha.get('total_avaliacoes')}
