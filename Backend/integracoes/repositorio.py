"""Persistência das Integrações: contas (`integracoes`, com o último Resultado da integração),
prévias (`importacao_previas`) e a leitura dos Itens do Usuário que a aplicação dos itens precisa.
Só SQL; as regras ficam no `servico` e o formato do que vai nos jsonb, no `integracoes.resultado`.

`db` é onde a consulta roda: o módulo `banco` (uma transação por chamada) ou uma
`banco.Transacao` aberta pelo `servico`, para confirmar a prévia numa transação só."""
from __future__ import annotations

from typing import Any

from psycopg.types.json import Jsonb

import banco
from banco import consultar, consultar_um
from integracoes.plataforma import Conta, uuid_valido
from integracoes.resultado import Previa, Resultado, de_guardado, previa_de_guardada

#: Validade da prévia (Q113).
VALIDADE_PREVIA = '1 hour'

_COLUNAS_CONTA = 'plataforma, identificador, nome_exibicao, ultima_sincronizacao, ultimo_resultado'


def contas(id_usuario: str) -> dict[str, dict[str, Any]]:
    """As contas conectadas do Usuário, por plataforma."""
    linhas = consultar(f'SELECT {_COLUNAS_CONTA} FROM integracoes WHERE id_usuario = %s', (id_usuario,))
    return {linha['plataforma']: linha for linha in linhas}


def conta(id_usuario: str, plataforma: str) -> dict[str, Any] | None:
    return consultar_um(
        f'SELECT {_COLUNAS_CONTA} FROM integracoes WHERE id_usuario = %s AND plataforma = %s',
        (id_usuario, plataforma),
    )


def gravar_conta(id_usuario: str, plataforma: str, nova: Conta) -> dict[str, Any]:
    """Conecta (ou troca) a conta. Trocar o identificador zera a última sincronização."""
    return consultar_um(
        f"""
        INSERT INTO integracoes (id_usuario, plataforma, identificador, nome_exibicao)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (id_usuario, plataforma) DO UPDATE SET
            identificador = EXCLUDED.identificador,
            nome_exibicao = EXCLUDED.nome_exibicao,
            ultima_sincronizacao = CASE WHEN integracoes.identificador = EXCLUDED.identificador
                THEN integracoes.ultima_sincronizacao END,
            ultimo_resultado = CASE WHEN integracoes.identificador = EXCLUDED.identificador
                THEN integracoes.ultimo_resultado END
        RETURNING {_COLUNAS_CONTA}
        """,
        (id_usuario, plataforma, nova.identificador, nova.nome_exibicao),
    )


def remover_conta(id_usuario: str, plataforma: str) -> None:
    """Apaga a conta e as prévias dela, numa transação."""
    with banco.transacao() as t:
        t.executar('DELETE FROM importacao_previas WHERE id_usuario = %s AND plataforma = %s', (id_usuario, plataforma))
        t.executar('DELETE FROM integracoes WHERE id_usuario = %s AND plataforma = %s', (id_usuario, plataforma))


def registrar_resultado(id_usuario: str, plataforma: str, resultado: Resultado, db=banco) -> None:
    """Guarda o Resultado da integração (todos os Não encontrados) e a hora da sincronização."""
    db.executar(
        'UPDATE integracoes SET ultima_sincronizacao = now(), ultimo_resultado = %s '
        'WHERE id_usuario = %s AND plataforma = %s',
        (Jsonb(resultado.guardado()), id_usuario, plataforma),
    )


def ultimo_resultado_travado(db, id_usuario: str, plataforma: str) -> Resultado | None:
    """O último resultado guardado da conta, travado até o fim da transação `db`."""
    conta = db.consultar_um(
        'SELECT ultimo_resultado FROM integracoes WHERE id_usuario = %s AND plataforma = %s FOR UPDATE',
        (id_usuario, plataforma),
    )
    guardado = (conta or {}).get('ultimo_resultado')
    return de_guardado(guardado) if guardado else None


def trocar_ultimo_resultado(db, id_usuario: str, plataforma: str, resultado: Resultado) -> None:
    """Regrava o último resultado (sem mexer na hora da sincronização)."""
    db.executar(
        'UPDATE integracoes SET ultimo_resultado = %s WHERE id_usuario = %s AND plataforma = %s',
        (Jsonb(resultado.guardado()), id_usuario, plataforma),
    )


def criar_previa(id_usuario: str, plataforma: str, previa: Previa) -> dict[str, Any]:
    """Guarda a prévia por 1 h; apaga as vencidas e a anterior do Usuário na mesma plataforma (uma transação)."""
    with banco.transacao() as t:
        t.executar('DELETE FROM importacao_previas WHERE expira_em <= now()')
        t.executar('DELETE FROM importacao_previas WHERE id_usuario = %s AND plataforma = %s', (id_usuario, plataforma))
        return t.consultar_um(
            f"""
            INSERT INTO importacao_previas (id_usuario, plataforma, conteudo, expira_em)
            VALUES (%s, %s, %s, now() + interval '{VALIDADE_PREVIA}')
            RETURNING id_previa, expira_em
            """,
            (id_usuario, plataforma, Jsonb(previa.guardada())),
        )


def previas_travadas(db, id_usuario: str, plataforma: str) -> list[tuple[str, Previa]]:
    """(id_previa, prévia) do Usuário na plataforma, travadas até o fim da transação `db`."""
    linhas = db.consultar(
        'SELECT id_previa, conteudo FROM importacao_previas WHERE id_usuario = %s AND plataforma = %s FOR UPDATE',
        (id_usuario, plataforma),
    )
    return [(linha['id_previa'], previa_de_guardada(linha['conteudo'])) for linha in linhas]


def trocar_previa(db, id_previa: str, previa: Previa) -> None:
    """Regrava o conteúdo da prévia (sem mexer na validade)."""
    db.executar('UPDATE importacao_previas SET conteudo = %s WHERE id_previa = %s',
                (Jsonb(previa.guardada()), id_previa))


def ler_previa(id_usuario: str, id_previa: str) -> tuple[str, Previa] | None:
    """(plataforma, prévia) válida do Usuário, sem consumir. None se não vale."""
    if not uuid_valido(id_previa):
        return None
    linha = consultar_um(
        'SELECT plataforma, conteudo FROM importacao_previas '
        'WHERE id_previa = %s AND id_usuario = %s AND expira_em > now()',
        (id_previa, id_usuario),
    )
    return (linha['plataforma'], previa_de_guardada(linha['conteudo'])) if linha else None


def consumir_previa(id_usuario: str, id_previa: str, db=banco) -> tuple[str, Previa] | None:
    """Tira a prévia do banco e a devolve (plataforma, prévia). None se não existe, venceu
    ou é de outro Usuário.

    Dentro da transação do confirmar, o DELETE trava a linha até o commit: outro confirmar da
    mesma prévia espera e, com o commit, não acha mais nada; com rollback, a prévia volta.
    """
    if not uuid_valido(id_previa):
        return None
    linha = db.consultar_um(
        'DELETE FROM importacao_previas WHERE id_previa = %s AND id_usuario = %s AND expira_em > now() '
        'RETURNING plataforma, conteudo',
        (id_previa, id_usuario),
    )
    return (linha['plataforma'], previa_de_guardada(linha['conteudo'])) if linha else None


def itens_do_usuario(id_usuario: str, id_midias: list[str], db=banco) -> dict[str, dict[str, Any]]:
    """Os Itens do Usuário nessas Mídias, por id_midia, com o que `aplicar` lê."""
    if not id_midias:
        return {}
    linhas = db.consultar(
        'SELECT id_lista, id_midia, status_consumo, progresso_atual, nota_usuario, data_inicio, data_conclusao '
        'FROM lista_usuarios WHERE id_usuario = %s AND id_midia = ANY(%s::uuid[])',
        (id_usuario, id_midias),
    )
    return {linha['id_midia']: linha for linha in linhas}
