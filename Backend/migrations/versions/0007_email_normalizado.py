"""Email normalizado e único sem diferença de caixa (ticket 36 da revisão, spec `login-ux`).

- Normaliza os emails gravados como a aplicação normaliza os que entram
  (`dominio.email.normalizar_email`): sem invisíveis, espaço não separável como
  espaço, NFKC, sem espaços nas pontas, minúsculo. Dois Usuários que ficariam
  com o mesmo email fazem a migração falhar, sem mudar nada.
- Troca o `UNIQUE (email)` (`usuarios_email_key`, da 0001) por índice único em
  `lower(email)`. O downgrade restaura a constraint; os emails ficam normalizados.

Revision ID: 0007_email_normalizado
Revises: 0006_producao
Create Date: 2026-11-23
"""
import unicodedata
from collections import defaultdict

import sqlalchemy as sa
from alembic import op

revision = '0007_email_normalizado'
down_revision = '0006_producao'
branch_labels = None
depends_on = None

_INVISIVEIS = dict.fromkeys(map(ord, '\u200b\u200c\u200d\u2060\ufeff'))


def _normalizar(email: str) -> str:
    """Cópia congelada de `dominio.email.normalizar_email`: a migração não muda se ela mudar."""
    sem_invisiveis = email.translate(_INVISIVEIS).replace('\u00a0', ' ')
    return unicodedata.normalize('NFKC', sem_invisiveis).strip().lower()


def upgrade() -> None:
    conn = op.get_bind()
    usuarios = conn.execute(sa.text('SELECT id_usuario, email FROM usuarios')).all()

    por_email = defaultdict(list)
    for _id_usuario, email in usuarios:
        por_email[_normalizar(email)].append(email)
    colisoes = {normal: emails for normal, emails in por_email.items() if len(emails) > 1}
    if colisoes:
        lista = '; '.join(f'{normal}: {", ".join(map(repr, emails))}' for normal, emails in sorted(colisoes.items()))
        raise RuntimeError(
            'Emails de Usuários diferentes ficam iguais depois de normalizados '
            f'(junte ou corrija as contas e rode de novo): {lista}'
        )

    for id_usuario, email in usuarios:
        normal = _normalizar(email)
        if normal != email:
            conn.execute(
                sa.text('UPDATE usuarios SET email = :email WHERE id_usuario = :id'),
                {'email': normal, 'id': id_usuario},
            )

    op.execute(
        """
        ALTER TABLE usuarios DROP CONSTRAINT usuarios_email_key;
        CREATE UNIQUE INDEX uq_usuarios_email_lower ON usuarios (lower(email));
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP INDEX uq_usuarios_email_lower;
        ALTER TABLE usuarios ADD CONSTRAINT usuarios_email_key UNIQUE (email);
        """
    )
