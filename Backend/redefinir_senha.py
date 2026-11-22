"""Redefine a senha de um Usuário com uma Senha temporária (spec `producao`, ADR 0013).

Uso: `make redefinir-senha EMAIL=fulano@exemplo.com` (ou `python redefinir_senha.py EMAIL`).

Sem email em produção, o admin roda este script na própria máquina e repassa a senha
à pessoa. O script:

- gera uma Senha temporária aleatória, legível, e grava só o hash;
- marca `deve_trocar_senha` e a expiração em agora + 24 h;
- revoga os refresh tokens do Usuário, encerrando as sessões abertas.

A senha sai só no stdout, numa linha; o resto vai para o stderr. Basta DML, então usa a
`DATABASE_URL` (usuário da aplicação), lida do `.env.producao` da raiz do repo quando ele
existe, senão do ambiente. Email inexistente sai com código 1, sem mudar nada.
"""
from __future__ import annotations

import pathlib
import secrets
import sys

from dotenv import load_dotenv

ENV_PRODUCAO = pathlib.Path(__file__).resolve().parents[1] / '.env.producao'

#: Sem 0/O, 1/l/I: a senha é ditada ou copiada à mão.
ALFABETO = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
TAMANHO = 8
VALIDADE = '24 hours'


def carregar_ambiente(caminho: pathlib.Path = ENV_PRODUCAO) -> bool:
    """Lê o `.env.producao`, se existir; uma variável já no ambiente vence a do arquivo.

    Antes de importar `config` (via `banco`), para vencer o `.env` de dev que ele carrega.
    """
    if not caminho.exists():
        return False
    load_dotenv(caminho)
    return True


def gerar_senha() -> str:
    return ''.join(secrets.choice(ALFABETO) for _ in range(TAMANHO))


def redefinir(email: str) -> str | None:
    """Grava uma Senha temporária para o Usuário do email e devolve a senha; None se ele não existe."""
    from werkzeug.security import generate_password_hash

    import banco
    from repositories import RefreshTokenRepository

    senha = gerar_senha()
    with banco.transacao() as t:
        usuario = t.consultar_um(
            """
            UPDATE usuarios
            SET senha_hash = %s, deve_trocar_senha = TRUE, senha_temporaria_expira_em = now() + %s::interval
            WHERE email = %s
            RETURNING id_usuario
            """,
            (generate_password_hash(senha), VALIDADE, email),
        )
        if not usuario:
            return None
        RefreshTokenRepository().revogar_do_usuario(usuario['id_usuario'], t)
    return senha


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    if len(args) != 1 or not args[0].strip():
        print('Uso: make redefinir-senha EMAIL=fulano@exemplo.com', file=sys.stderr)
        return 2
    email = args[0].strip()

    senha = redefinir(email)
    if senha is None:
        print(f'Nenhum Usuário com o email {email}: nada foi alterado.', file=sys.stderr)
        return 1

    print(f'Senha temporária de {email}, válida por 24 h (sessões abertas encerradas):', file=sys.stderr)
    print(senha)
    return 0


if __name__ == '__main__':
    carregar_ambiente()
    sys.exit(main())
