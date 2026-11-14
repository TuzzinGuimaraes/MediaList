.DEFAULT_GOAL := help

# Diretórios relativos: as receitas fazem `cd "$(DIR)"` e o caminho do projeto
# pode conter espaços.
ROOT_DIR := $(CURDIR)
BACKEND_DIR := ./Backend
FRONTEND_DIR := ./Frontend
MOBILE_DIR := ./Mobile
DUMP_DIR := ./dumps

# Usa o venv do projeto quando existe. O caminho é relativo a Backend/, porque
# as receitas fazem `cd "$(BACKEND_DIR)"` antes.
# Sobrescreva quando precisar: make install PYTHON=/caminho/para/python
ifeq ($(origin PYTHON), undefined)
PYTHON := $(shell if [ -x "$(BACKEND_DIR)/.venv/bin/python" ]; then echo "./.venv/bin/python"; else echo "python3"; fi)
endif

PIP ?= $(PYTHON) -m pip
NPM ?= npm

DOCKER_COMPOSE ?= docker compose
# Versão fixa: a saída entra no git e o CI compara (contrato/api.d.ts).
# --default-non-nullable false: campo com default (query, `detalhes` do erro) fica opcional no TS.
OPENAPI_TYPESCRIPT ?= npx --yes openapi-typescript@7.13.0
IMPORT_WORKERS ?= 8
DUMP_NAME ?= medialist_$(shell date +%Y%m%d_%H%M%S).dump
DUMP_FILE ?= $(DUMP_DIR)/$(DUMP_NAME)

.PHONY: help install install-backend install-frontend install-mobile mobile-dev compose-build services-up \
	services-down services-logs db-migrate db-revision db-shell db-grants backend-dev frontend-dev smoke-postgres \
	smoke-permissions smoke test-backend test-frontend test-mobile test lint lint-backend lint-frontend \
	lint-mobile build-frontend build api-tipos \
	import-animes import-mangas import-jogos import-all seed-dev clean-frontend db-dump db-restore

help:
	@printf "\nMediaList - comandos principais\n\n"
	@printf "  make services-up       Sobe frontend, backend e PostgreSQL via Docker\n"
	@printf "  make compose-build     Rebuilda as imagens Docker de backend e frontend\n"
	@printf "  make db-migrate        Aplica as migrações pendentes (alembic upgrade head, serviço migrate)\n"
	@printf "  make db-revision MSG=\"...\" Cria uma revisão nova em Backend/migrations/versions\n"
	@printf "  make db-shell          Abre o psql (usuário dono) dentro do container\n"
	@printf "  make db-grants         Reaplica o usuário da aplicação e os grants num banco existente\n"
	@printf "  make db-dump           Gera um dump (pg_dump -Fc) em ./dumps\n"
	@printf "  make db-restore        Restaura um dump com DUMP_FILE=/caminho/arquivo.dump\n"
	@printf "  make smoke-postgres    Executa o smoke test de PostgreSQL no container backend\n"
	@printf "  make smoke-permissions Executa o script de permissões no container backend\n"
	@printf "  make import-animes     Importa animes no container backend\n"
	@printf "  make import-mangas     Importa mangás no container backend\n"
	@printf "  make import-jogos      Importa jogos no container backend com concorrência limitada\n"
	@printf "  make import-all        Executa todos os importadores no container backend\n"
	@printf "  make seed-dev          Cria os dados de desenvolvimento (SEED_ARGS=--recriar refaz)\n"
	@printf "  make install           Instala dependências locais para desenvolvimento sem Docker\n"
	@printf "  make backend-dev       Inicia a API Flask no host em http://localhost:5000\n"
	@printf "  make frontend-dev      Inicia o React no host em http://localhost:3005\n"
	@printf "  make mobile-dev        Sobe o Expo para o Expo Go; no WSL2, anuncia o IP do Windows na porta 8081\n"
	@printf "  make smoke             Executa os dois smoke tests no container backend\n"
	@printf "  make test              Executa os testes do backend, do frontend e do mobile no host\n"
	@printf "  make test-backend      Executa o pytest do backend no host\n"
	@printf "  make test-frontend     Executa os testes do frontend no host\n"
	@printf "  make test-mobile       Executa os testes do mobile no host\n"
	@printf "  make lint              Roda ruff (backend), eslint (frontend) e o lint do mobile\n"
	@printf "  make api-tipos         Regera contrato/openapi.json e contrato/api.d.ts a partir do Backend\n"
	@printf "  make build-frontend    Gera a build do frontend no host\n"
	@printf "  make services-logs     Mostra logs do Docker Compose\n"
	@printf "  make services-down     Derruba os containers do stack\n"
	@printf "\nVariáveis úteis no Docker: BACKEND_PORT, FRONTEND_PORT, POSTGRES_PORT, RAWG_API_KEY, IMPORT_WORKERS\n\n"

install: install-backend install-frontend install-mobile

install-backend:
	cd "$(BACKEND_DIR)" && $(PIP) install -r requirements-dev.txt

install-frontend:
	cd "$(FRONTEND_DIR)" && $(NPM) install

install-mobile:
	cd "$(MOBILE_DIR)" && $(NPM) install

compose-build:
	$(DOCKER_COMPOSE) build backend frontend

services-up:
	$(DOCKER_COMPOSE) up -d postgres backend frontend

services-down:
	$(DOCKER_COMPOSE) down

services-logs:
	$(DOCKER_COMPOSE) logs -f

# One-shot: o serviço migrate roda `alembic upgrade head` com o usuário dono.
db-migrate:
	$(DOCKER_COMPOSE) up -d --wait postgres
	$(DOCKER_COMPOSE) run --rm --build migrate

# Gera o arquivo da revisão no host (Backend/migrations/versions); o SQL é
# escrito à mão em op.execute. Ex.: make db-revision MSG="cria tabela x"
db-revision:
	@test -n "$(MSG)" || (printf "Defina MSG=\"descricao da revisao\"\n" && exit 1)
	cd "$(BACKEND_DIR)" && $(PYTHON) -m alembic revision -m "$(MSG)"

db-shell:
	$(DOCKER_COMPOSE) up -d --wait postgres
	$(DOCKER_COMPOSE) exec postgres sh -c 'exec psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

# Reaplica o docker/postgres-init (usuário da aplicação e grants) num volume que
# já existe: o init do container só roda com volume vazio. Idempotente; roda
# como o dono (POSTGRES_USER), com as variáveis do serviço postgres.
db-grants:
	$(DOCKER_COMPOSE) up -d --wait postgres
	$(DOCKER_COMPOSE) exec -T postgres sh /docker-entrypoint-initdb.d/01-app-user.sh

# Formato custom do pg_dump (-Fc): restaura com pg_restore, inclusive seletivo.
db-dump:
	mkdir -p "$(DUMP_DIR)"
	$(DOCKER_COMPOSE) up -d --wait postgres
	$(DOCKER_COMPOSE) exec -T postgres sh -c 'exec pg_dump -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -Fc' > "$(DUMP_FILE)"
	@printf "Dump criado em: %s\n" "$(DUMP_FILE)"

# Substitui o conteúdo do banco pelo do dump (--clean --if-exists), mantendo os
# grants do usuário da aplicação, que vêm dos default privileges do dono.
db-restore:
	@test -n "$(DUMP_FILE)" || (printf "Defina DUMP_FILE=/caminho/arquivo.dump\n" && exit 1)
	@test -f "$(DUMP_FILE)" || (printf "Arquivo de dump não encontrado: %s\n" "$(DUMP_FILE)" && exit 1)
	$(DOCKER_COMPOSE) up -d --wait postgres
	$(DOCKER_COMPOSE) exec -T postgres sh -c 'exec pg_restore -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" --clean --if-exists --no-owner --role="$$POSTGRES_USER" --exit-on-error' < "$(DUMP_FILE)"
	@printf "Dump restaurado a partir de: %s\n" "$(DUMP_FILE)"

backend-dev:
	$(DOCKER_COMPOSE) up -d postgres
	cd "$(BACKEND_DIR)" && $(PYTHON) app.py

frontend-dev:
	cd "$(FRONTEND_DIR)" && $(NPM) start

# No WSL2 confere o portproxy do Windows e fixa a porta 8081 (Mobile/scripts/dev.sh).
# MOBILE_ARGS vai para o script: --dry-run só verifica; o resto vai para o expo start.
mobile-dev:
	cd "$(MOBILE_DIR)" && bash scripts/dev.sh $(MOBILE_ARGS)

smoke-postgres:
	$(DOCKER_COMPOSE) up -d --wait postgres
	$(DOCKER_COMPOSE) run --rm backend python smoke_postgres.py

smoke-permissions:
	$(DOCKER_COMPOSE) up -d postgres
	$(DOCKER_COMPOSE) run --rm backend python smoke_permissions.py

smoke: smoke-postgres smoke-permissions

test-backend:
	cd "$(BACKEND_DIR)" && $(PYTHON) -m pytest -q

test-frontend:
	cd "$(FRONTEND_DIR)" && CI=true $(NPM) test -- --watchAll=false

test-mobile:
	cd "$(MOBILE_DIR)" && $(NPM) test -- --ci

test: test-backend test-frontend test-mobile

lint-backend:
	cd "$(BACKEND_DIR)" && $(PYTHON) -m ruff check .

lint-frontend:
	cd "$(FRONTEND_DIR)" && npx eslint src

lint-mobile:
	cd "$(MOBILE_DIR)" && $(NPM) run lint

lint: lint-backend lint-frontend lint-mobile

# Contrato da API (ADR 0011): OpenAPI exportado sem subir o servidor, e os tipos
# TS gerados dele. Os dois arquivos entram no git; o CI falha se ficarem velhos.
api-tipos:
	cd "$(BACKEND_DIR)" && $(PYTHON) exportar_openapi.py
	$(OPENAPI_TYPESCRIPT) contrato/openapi.json --output contrato/api.d.ts --default-non-nullable false

build-frontend:
	cd "$(FRONTEND_DIR)" && $(NPM) run build

build: build-frontend

import-animes:
	$(DOCKER_COMPOSE) up -d postgres
	$(DOCKER_COMPOSE) run --rm backend python -m importacao.run_import --tipo anime --paginas 100 --workers $(IMPORT_WORKERS)

import-mangas:
	$(DOCKER_COMPOSE) up -d postgres
	$(DOCKER_COMPOSE) run --rm backend python -m importacao.run_import --tipo manga --paginas 100 --workers $(IMPORT_WORKERS)

import-jogos:
	$(DOCKER_COMPOSE) up -d postgres
	$(DOCKER_COMPOSE) run --rm backend python -m importacao.run_import --tipo jogo --paginas 100 --workers $(IMPORT_WORKERS)

import-all:
	$(DOCKER_COMPOSE) up -d postgres
	$(DOCKER_COMPOSE) run --rm backend python -m importacao.run_import --tipo todos --paginas 100 --workers $(IMPORT_WORKERS)

# Dados de desenvolvimento (Backend/seed_dev.py); idempotente, recusa APP_ENV=production.
# SEED_ARGS=--recriar apaga e recria os Usuários do seed e o que é deles.
seed-dev:
	$(DOCKER_COMPOSE) up -d --wait postgres
	$(DOCKER_COMPOSE) run --rm --build backend python -m seed_dev $(SEED_ARGS)

clean-frontend:
	rm -rf "$(FRONTEND_DIR)/build"
