"""Exporta o OpenAPI da API para `contrato/openapi.json`, na raiz do repositório.

Não sobe o servidor nem abre o banco: monta o documento a partir das rotas
registradas no app. `make api-tipos` roda este script e depois o
`openapi-typescript`, que gera `contrato/api.d.ts`.

Uso: python exportar_openapi.py [destino]
"""
import json
import pathlib
import sys

from app import app
from contrato import contrato

DESTINO = pathlib.Path(__file__).resolve().parents[1] / 'contrato' / 'openapi.json'


def documento() -> str:
    """O OpenAPI como texto estável: chaves ordenadas, UTF-8, LF no fim."""
    with app.app_context():
        return json.dumps(contrato.spec, indent=2, ensure_ascii=False, sort_keys=True) + '\n'


def main(argv: list[str]) -> None:
    destino = pathlib.Path(argv[1]) if len(argv) > 1 else DESTINO
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(documento(), encoding='utf-8', newline='\n')
    print(f'OpenAPI exportado em {destino}')


if __name__ == '__main__':
    main(sys.argv)
