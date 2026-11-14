"""Teste rapido e deterministico do Nivel de acesso (nivel_de_acesso) contra o PostgreSQL."""
from __future__ import annotations

import sys

from banco import consultar
from decorators import nivel_de_acesso

#: uuid que nenhum Usuário tem (os ids são uuidv7).
USUARIO_INEXISTENTE = '00000000-0000-0000-0000-000000000000'
NIVEIS = {'usuario', 'admin'}


def run_checks() -> dict:
    """Todo Usuário tem um Nível conhecido; o inexistente é `usuario`."""
    report = {
        'usuarios_consultados': 0,
        'usuarios_validos': 0,
        'fallback_ok': False,
    }

    usuarios = consultar("SELECT id_usuario, nome_completo, email FROM usuarios LIMIT 5")
    report['usuarios_consultados'] = len(usuarios)

    for usuario in usuarios:
        if nivel_de_acesso(usuario['id_usuario']) in NIVEIS:
            report['usuarios_validos'] += 1

    # Usuário inexistente não ganha nada além do Nível comum.
    report['fallback_ok'] = nivel_de_acesso(USUARIO_INEXISTENTE) == 'usuario'

    return report


def main() -> int:
    try:
        report = run_checks()
        print("TESTANDO NIVEL_DE_ACESSO")
        print(f"usuarios_consultados={report['usuarios_consultados']}")
        print(f"usuarios_validos={report['usuarios_validos']}")
        print(f"fallback_ok={report['fallback_ok']}")
        if report['usuarios_consultados'] > 0 and report['usuarios_validos'] != report['usuarios_consultados']:
            return 1
        return 0 if report['fallback_ok'] else 1
    except Exception as exc:
        print(f"ERRO_PERMISSIONS={exc}")
        return 1


if __name__ == '__main__':
    sys.exit(main())
