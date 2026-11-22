#!/bin/sh
# Cria o usuário da aplicação e aplica os grants dele. Idempotente.
# Roda sozinho no primeiro start com volume vazio (docker-entrypoint-initdb.d);
# num banco que já existe, `make db-grants` roda este mesmo script de novo, e o
# workflow db-grants roda ele contra o Neon (ADR-0013).
# Conexão: com DATABASE_OWNER_URL (workflow), usa a URL; sem ela (container),
# o POSTGRES_USER no POSTGRES_DB. Quem conecta é sempre o dono do banco: ele
# roda as migrações e é dono de todas as tabelas. O usuário da aplicação
# (DB_USER) tem DML e nada de DDL. Os default privileges cobrem as tabelas que
# as migrações do dono criarem depois; o GRANT ON ALL cobre as que já existem.
# Os valores vão como variáveis do psql (:"ident" e :'literal'), que o psql
# escapa; nada é interpolado pelo shell no SQL.
set -e

: "${DB_USER:?defina DB_USER}"
: "${DB_PASSWORD:?defina DB_PASSWORD}"

if [ -n "${DATABASE_OWNER_URL:-}" ]; then
    set -- --dbname "$DATABASE_OWNER_URL"
else
    set -- --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"
fi

psql -v ON_ERROR_STOP=1 --no-psqlrc "$@" \
    -v app_user="$DB_USER" -v app_password="$DB_PASSWORD" <<'SQL'
-- Só cria se não existir; um papel existente fica como está (senha inclusive).
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'app_user', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user')
\gexec

-- O banco é o da conexão: o nome vem do current_database(), não de fora.
SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database())
\gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'app_user')
\gexec
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO :"app_user";

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :"app_user";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO :"app_user";

-- Sem FOR ROLE: vale para o papel conectado, que é o dono (quem migra).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO :"app_user";
SQL
