#!/bin/sh
# Cria o usuário da aplicação e aplica os grants dele. Idempotente.
# Roda sozinho no primeiro start com volume vazio (docker-entrypoint-initdb.d);
# num banco que já existe, `make db-grants` roda este mesmo script de novo.
# O dono do banco é o POSTGRES_USER (DB_OWNER_USER no compose): ele roda as
# migrações e é dono de todas as tabelas. O usuário da aplicação (DB_USER) tem
# DML e nada de DDL. Os default privileges cobrem as tabelas que as migrações do
# dono criarem depois; o GRANT ON ALL cobre as que já existem.
# Os valores vão como variáveis do psql (:"ident" e :'literal'), que o psql
# escapa; nada é interpolado pelo shell no SQL.
set -e

: "${DB_USER:?defina DB_USER}"
: "${DB_PASSWORD:?defina DB_PASSWORD}"

psql -v ON_ERROR_STOP=1 \
    --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    -v app_user="$DB_USER" -v app_password="$DB_PASSWORD" \
    -v owner="$POSTGRES_USER" -v db_name="$POSTGRES_DB" <<'SQL'
-- Só cria se não existir; um papel existente fica como está (senha inclusive).
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'app_user', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user')
\gexec

REVOKE ALL ON DATABASE :"db_name" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"db_name" TO :"app_user";
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO :"app_user";

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO :"app_user";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO :"app_user";

ALTER DEFAULT PRIVILEGES FOR ROLE :"owner" IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app_user";
ALTER DEFAULT PRIVILEGES FOR ROLE :"owner" IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO :"app_user";
SQL
