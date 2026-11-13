"""Ambiente do Alembic: migrações em SQL puro (op.execute), sem metadata de ORM.

Conecta com o dono do schema (DB_OWNER_USER), nunca com o usuário da aplicação,
que só tem DML.
"""
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

from config import database_url

if context.config.config_file_name is not None:
    fileConfig(context.config.config_file_name)


def _url() -> str:
    # O SQLAlchemy precisa do driver explícito; sem ele tentaria o psycopg2.
    return database_url(dono=True).replace('postgresql://', 'postgresql+psycopg://', 1)


def run_migrations_offline() -> None:
    context.configure(url=_url(), literal_binds=True, transaction_per_migration=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(_url(), poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(connection=connection, transaction_per_migration=True)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
