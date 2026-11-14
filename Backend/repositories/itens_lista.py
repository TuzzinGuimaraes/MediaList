"""
Lista pessoal: leitura e gravação dos Itens de lista.

Só persistência. As regras do Item (Rótulo por Tipo, Progresso, Concluído ⇔
total, dono) vivem em `dominio.lista_pessoal`, que chama este módulo; a rota de
leitura o chama direto. `id_lista` vem do banco (uuidv7), e `progresso_total` é
copiado da Mídia na criação.
"""
from __future__ import annotations

from typing import Any

from banco import consultar, consultar_um, executar
from tipos_midia import TIPOS, joins_das_filhas, por_tipo

from .catalogo import FROM_MIDIA, SELECT_MIDIA, com_generos_lista

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

#: Total da Mídia (episódios do anime, capítulos do mangá; NULL no jogo).
#: Precisa de `m` e das tabelas filhas no FROM.
TOTAL_DA_MIDIA = 'COALESCE(' + ', '.join(
    f'{t.apelido}.{t.coluna_total}' for t in TIPOS.values() if t.coluna_total
) + ')'

#: Colunas do Item que a listagem acrescenta às da Mídia; o que sai na
#: resposta é decidido pelo modelo `ItemLista` (schemas/lista.py).
COLUNAS_DO_ITEM = """
    lu.id_lista,
    lu.status_consumo,
    lu.progresso_atual,
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
"""


def _chave_alfabetica(item: dict[str, Any]) -> tuple[str, str]:
    """Título exibido (mesma regra do `tituloDaMidia` do app e do web) sem caixa, e o id_lista."""
    titulo = item.get('titulo_portugues') or item.get('titulo_original') or ''
    return titulo.casefold(), str(item.get('id_lista') or '')


def _valor(campo: str, valor: Any) -> Any:
    return bool(valor) if campo in CAMPOS_BOOLEANOS else valor


class ItensLista:
    """Os Itens de lista de todos os Usuários."""

    def listar(self, id_usuario: str, tipo: str | None = None, status: str | None = None) -> list[dict[str, Any]]:
        """A Lista do Usuário: cada Item com a Mídia inteira, em ordem alfabética do título exibido.

        O id_lista desempata: editar um Item não o tira do lugar (ticket 28).
        A ordem é feita aqui, e não no SQL, para não depender da collation.
        """
        query = f"""
            {SELECT_MIDIA}, {COLUNAS_DO_ITEM}
            {FROM_MIDIA}
            JOIN lista_usuarios lu ON lu.id_midia = m.id_midia
            WHERE lu.id_usuario = %s
        """
        params: list[Any] = [id_usuario]
        if tipo:
            query += ' AND tm.nome_tipo = %s'
            params.append(tipo)
        if status:
            query += ' AND lu.status_consumo = %s'
            params.append(status)

        return sorted((com_generos_lista(linha) for linha in consultar(query, params)), key=_chave_alfabetica)

    def criar_item(self, id_usuario: str, id_midia: str, campos: dict[str, Any]) -> str | None:
        """Insere o Item e devolve o `id_lista`, ou None se já existia.

        A unique key (usuário, mídia) garante uma Mídia por Usuário: `ON
        CONFLICT DO NOTHING` sem linha devolvida é o Item já existente.
        """
        gravados = [c for c in COLUNAS_GRAVAVEIS if campos.get(c) is not None]
        criado = consultar_um(
            f"""
            INSERT INTO lista_usuarios (id_usuario, id_midia, progresso_total{''.join(f', {c}' for c in gravados)})
            VALUES (%s, %s, (
                SELECT {TOTAL_DA_MIDIA} FROM midias m {joins_das_filhas('m')} WHERE m.id_midia = %s
            ){', %s' * len(gravados)})
            ON CONFLICT (id_usuario, id_midia) DO NOTHING
            RETURNING id_lista
            """,
            (id_usuario, id_midia, id_midia, *(_valor(c, campos[c]) for c in gravados)),
        )
        return criado['id_lista'] if criado else None

    def atualizar_campos(self, id_lista: str, campos: dict[str, Any]) -> bool:
        """Grava os campos num Item, numa escrita só. False quando não havia nada a gravar.

        `nota_usuario` vazia apaga a Nota pessoal; `data_atualizacao` fica com o trigger.
        """
        gravados = [c for c in COLUNAS_GRAVAVEIS if c in campos]
        if not gravados:
            return False

        valores = {c: None if c == 'nota_usuario' and campos[c] == '' else _valor(c, campos[c]) for c in gravados}
        executar(
            f"UPDATE lista_usuarios SET {', '.join(f'{c} = %s' for c in gravados)} WHERE id_lista = %s",
            (*valores.values(), id_lista),
        )
        return True

    def remover_item(self, id_lista: str, id_usuario: str) -> bool:
        """Apaga o Item do Usuário e diz se alguma linha saiu: Item de outro não sai."""
        return executar(
            'DELETE FROM lista_usuarios WHERE id_lista = %s AND id_usuario = %s', (id_lista, id_usuario)
        ) > 0

    def obter_item_por_id(self, id_lista: str) -> dict[str, Any] | None:
        """O Item com o Tipo e o total da Mídia, para dono e validação.

        `progresso_total_padrao` vem da Mídia, não da cópia no Item: é ele que
        decide Concluído.
        """
        return consultar_um(
            f"""
            SELECT lu.id_lista, lu.id_usuario, lu.id_midia, lu.status_consumo, lu.progresso_atual,
                   lu.progresso_total, lu.data_conclusao, lu.total_rewatches,
                   tm.nome_tipo AS tipo,
                   {por_tipo('tm.nome_tipo', lambda t: t.coluna_total and f'{t.apelido}.{t.coluna_total}')}
                       AS progresso_total_padrao
            FROM lista_usuarios lu
            JOIN midias m ON m.id_midia = lu.id_midia
            JOIN tipo_midia tm ON tm.id_tipo = m.id_tipo
            {joins_das_filhas('m')}
            WHERE lu.id_lista = %s
            """,
            (id_lista,),
        )

    def obter_item_usuario(self, id_usuario: str, id_midia: str) -> dict[str, Any] | None:
        """O Item do Usuário para a Mídia, ou None."""
        return consultar_um(
            'SELECT id_lista, id_usuario, id_midia FROM lista_usuarios WHERE id_usuario = %s AND id_midia = %s',
            (id_usuario, id_midia),
        )
