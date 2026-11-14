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


#: Uma Avaliação com nome e foto do autor.
SELECT_AVALIACAO = """
    SELECT av.id_avaliacao, av.id_usuario, av.id_midia, av.nota, av.titulo_avaliacao,
           av.texto_avaliacao, av.data_avaliacao, av.data_edicao, u.nome_completo, u.foto_perfil
    FROM avaliacoes av
    JOIN usuarios u ON u.id_usuario = av.id_usuario
"""


class AvaliacaoRepository:
    def listar(self, id_midia: str, limite: int, deslocamento: int) -> list[dict[str, Any]]:
        """Uma página das Avaliações da Mídia, com nome e foto do autor, mais recentes primeiro.

        O id desempata o instante, para a página não repetir nem pular Avaliação.
        """
        return consultar(
            f"""{SELECT_AVALIACAO}
            WHERE av.id_midia = %s
            ORDER BY av.data_avaliacao DESC, av.id_avaliacao DESC
            LIMIT %s OFFSET %s
            """,
            (id_midia, limite, deslocamento),
        )

    def do_usuario(self, id_midia: str, id_usuario: str) -> dict[str, Any] | None:
        """A Avaliação do Usuário para a Mídia (no máximo uma), ou None."""
        return consultar_um(f'{SELECT_AVALIACAO} WHERE av.id_midia = %s AND av.id_usuario = %s', (id_midia, id_usuario))

    def distribuicao(self, id_midia: str) -> list[dict[str, Any]]:
        """Quantas Avaliações da Mídia caem em cada nota inteira de 1 a 10, todas as faixas.

        A faixa é a nota arredondada, meio para cima (7,5 cai no 8), como o web e o app já
        desenhavam; nota abaixo de 0,5 não entra em faixa nenhuma.
        """
        return consultar(
            """
            SELECT faixa.nota, count(av.id_avaliacao) AS total
            FROM generate_series(1, 10) AS faixa(nota)
            LEFT JOIN avaliacoes av ON av.id_midia = %s AND round(av.nota) = faixa.nota
            GROUP BY faixa.nota
            ORDER BY faixa.nota
            """,
            (id_midia,),
        )

    def contar(self, id_midia: str) -> int:
        """Quantas Avaliações a Mídia tem, em todas as páginas."""
        return consultar_um('SELECT count(*) AS total FROM avaliacoes WHERE id_midia = %s', (id_midia,))['total']

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
