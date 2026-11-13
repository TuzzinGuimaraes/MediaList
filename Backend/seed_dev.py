"""Seed de desenvolvimento (ticket 15). Uso: python -m seed_dev [--recriar]."""
from __future__ import annotations

import argparse
import os
import sys


def main(argv: list[str] | None = None) -> int:
    argparse.ArgumentParser(prog='python -m seed_dev').parse_args(argv)
    if os.getenv('APP_ENV', 'development') == 'production':
        print('seed_dev: recusado em produção (APP_ENV=production); o seed é só para desenvolvimento.', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
