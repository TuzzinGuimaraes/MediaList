#!/bin/sh
# Roda uma vez, no primeiro start com volume vazio (docker-entrypoint-initdb.d).
# O dono do banco é o POSTGRES_USER (DB_OWNER_USER no compose): ele roda as
# migrações e é dono de todas as tabelas. Aqui só nasce o usuário da aplicação
# (DB_USER), com DML e nada de DDL. Os default privileges cobrem as tabelas que
# as migrações do dono criarem depois.
# Os valores vão como variáveis do psql (:"ident" e :'literal'), que o psql
# escapa; nada é interpolado pelo shell no SQL.
set -e

: "${DB_USER:?defina DB_USER}"
: "${DB_PASSWORD:?defina DB_PASSWORD}"

psql -v ON_ERROR_STOP=1 \
    --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    -v app_user="$DB_USER" -v app_password="$DB_PASSWORD" \
    -v owner="$POSTGRES_USER" -v db_name="$POSTGRES_DB" <<'SQL'
CREATE ROLE :"app_user" LOGIN PASSWORD :'app_password';

REVOKE ALL ON DATABASE :"db_name" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"db_name" TO :"app_user";
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO :"app_user";

ALTER DEFAULT PRIVILEGES FOR ROLE :"owner" IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app_user";
ALTER DEFAULT PRIVILEGES FOR ROLE :"owner" IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO :"app_user";
SQL
