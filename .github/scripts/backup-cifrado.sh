#!/usr/bin/env bash
# Backup cifrado do banco (ADR-0013): pg_dump -Fc com o dono, direto no age.
# O dump em claro só passa pelo pipe; nunca vai para o disco nem para o log.
# Usado pelo workflow backup e no teste local do runbook (docs/backup-restauracao.md).
#
# Uso: DATABASE_OWNER_URL=... BACKUP_AGE_RECIPIENT=age1... backup-cifrado.sh <saida.dump.age>
# O pg_dump 18 roda na imagem postgres (PG_IMAGE), compatível com o PostgreSQL 18 da Neon.
set -euo pipefail

PG_IMAGE="${PG_IMAGE:-postgres:18.6}"
saida="${1:?uso: backup-cifrado.sh <saida.dump.age>}"

if [ -z "${DATABASE_OWNER_URL:-}" ]; then
  echo "DATABASE_OWNER_URL ausente" >&2
  exit 1
fi
if [ -z "${BACKUP_AGE_RECIPIENT:-}" ]; then
  echo "BACKUP_AGE_RECIPIENT ausente" >&2
  exit 1
fi

# Escreve num temporário e só renomeia no fim: um dump interrompido não vira
# um arquivo de backup com cara de válido.
parcial="${saida}.parcial"
trap 'rm -f "$parcial"' EXIT

# A URL vai ao container por variável de ambiente (-e sem valor), fora da linha
# de comando e do log. --network host alcança tanto a Neon quanto um Postgres local.
docker run --rm --network host -e DATABASE_OWNER_URL "$PG_IMAGE" \
  sh -c 'exec pg_dump -Fc -d "$DATABASE_OWNER_URL"' \
  | age -r "$BACKUP_AGE_RECIPIENT" -o "$parcial"

mv "$parcial" "$saida"
trap - EXIT
echo "Backup cifrado: $saida ($(wc -c < "$saida") bytes)"
