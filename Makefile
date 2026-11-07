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
IMPORT_WORKERS ?= 8
DUMP_NAME ?= medialist_$(shell date +%Y%m%d_%H%M%S).sql
DUMP_FILE ?= $(DUMP_DIR)/$(DUMP_NAME)

.PHONY: help install install-backend install-frontend install-mobile compose-build services-up services-up-dev \
	services-down services-logs db-schema db-migrate-refresh db-shell backend-dev frontend-dev smoke-mysql \
	smoke-mongo smoke-permissions smoke test-backend test-frontend test-mobile test build-frontend build \
	import-animes import-mangas import-jogos import-all clean-frontend db-dump db-restore

help:
	@printf "\nMediaList - comandos principais\n\n"
	@printf "  make services-up       Sobe frontend, backend, MySQL e MongoDB via Docker\n"
	@printf "  make services-up-dev   Sobe o stack completo e habilita mongo-express\n"
	@printf "  make compose-build     Rebuilda as imagens Docker de backend e frontend\n"
	@printf "  make db-schema         Reaplica Banco DDL.sql no MySQL do Docker\n"
	@printf "  make db-migrate-refresh Cria a tabela refresh_tokens num banco existente\n"
	@printf "  make db-shell          Abre o cliente MySQL dentro do container\n"
	@printf "  make db-dump          Gera um dump SQL completo em ./dumps\n"
	@printf "  make db-restore       Restaura um dump com DUMP_FILE=/caminho/arquivo.sql\n"
	@printf "  make smoke-mysql       Executa o smoke test de MySQL no container backend\n"
	@printf "  make smoke-mongo       Executa o smoke test de MongoDB no container backend\n"
	@printf "  make smoke-permissions Executa o script de permissões no container backend\n"
	@printf "  make import-animes     Importa animes no container backend\n"
	@printf "  make import-mangas     Importa mangás no container backend\n"
	@printf "  make import-jogos      Importa jogos no container backend com concorrência limitada\n"
	@printf "  make import-all        Executa todos os importadores no container backend\n"
	@printf "  make install           Instala dependências locais para desenvolvimento sem Docker\n"
	@printf "  make backend-dev       Inicia a API Flask no host em http://localhost:5000\n"
	@printf "  make frontend-dev      Inicia o React no host em http://localhost:3005\n"
	@printf "  make smoke             Executa os três smoke tests no container backend\n"
	@printf "  make test              Executa os testes do backend, do frontend e do mobile no host\n"
	@printf "  make test-backend      Executa o pytest do backend no host\n"
	@printf "  make test-frontend     Executa os testes do frontend no host\n"
	@printf "  make test-mobile       Executa os testes do mobile no host\n"
	@printf "  make build-frontend    Gera a build do frontend no host\n"
	@printf "  make services-logs     Mostra logs do Docker Compose\n"
	@printf "  make services-down     Derruba os containers do stack\n"
	@printf "\nVariáveis úteis no Docker: BACKEND_PORT, FRONTEND_PORT, MYSQL_PORT, MONGO_PORT, RAWG_API_KEY, IMPORT_WORKERS\n\n"

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
	$(DOCKER_COMPOSE) up -d mysql mongodb backend frontend

services-up-dev:
	$(DOCKER_COMPOSE) --profile dev up -d

services-down:
	$(DOCKER_COMPOSE) down

services-logs:
	$(DOCKER_COMPOSE) logs -f

db-schema:
	$(DOCKER_COMPOSE) up -d mysql
	$(DOCKER_COMPOSE) exec -T mysql sh -lc 'until mysqladmin ping -h 127.0.0.1 -uroot -p"$$MYSQL_ROOT_PASSWORD" --silent > /dev/null 2>&1; do sleep 2; done; exec mysql -uroot -p"$$MYSQL_ROOT_PASSWORD"' < "$(ROOT_DIR)/Banco DDL.sql"

db-migrate-refresh:
	$(DOCKER_COMPOSE) up -d mysql
	$(DOCKER_COMPOSE) exec -T mysql sh -lc 'until mysqladmin ping -h 127.0.0.1 -uroot -p"$$MYSQL_ROOT_PASSWORD" --silent > /dev/null 2>&1; do sleep 2; done; exec mysql -uroot -p"$$MYSQL_ROOT_PASSWORD"' < "$(ROOT_DIR)/Banco migracao 0006 refresh tokens.sql"

db-shell:
	$(DOCKER_COMPOSE) up -d mysql
	$(DOCKER_COMPOSE) exec mysql sh -lc 'exec mysql -uroot -p"$$MYSQL_ROOT_PASSWORD"'

db-dump:
	mkdir -p "$(DUMP_DIR)"
	$(DOCKER_COMPOSE) up -d mysql
	$(DOCKER_COMPOSE) exec -T mysql sh -lc 'until mysqladmin ping -h 127.0.0.1 -uroot -p"$$MYSQL_ROOT_PASSWORD" --silent > /dev/null 2>&1; do sleep 2; done; exec mysqldump -uroot -p"$$MYSQL_ROOT_PASSWORD" --single-transaction --routines --triggers --events --set-gtid-purged=OFF --databases "$${DB_NAME:-medialist_db}"' > "$(DUMP_FILE)"
	@printf "Dump criado em: %s\n" "$(DUMP_FILE)"

db-restore:
	@test -n "$(DUMP_FILE)" || (printf "Defina DUMP_FILE=/caminho/arquivo.sql\n" && exit 1)
	@test -f "$(DUMP_FILE)" || (printf "Arquivo de dump não encontrado: %s\n" "$(DUMP_FILE)" && exit 1)
	$(DOCKER_COMPOSE) up -d mysql
	$(DOCKER_COMPOSE) exec -T mysql sh -lc 'until mysqladmin ping -h 127.0.0.1 -uroot -p"$$MYSQL_ROOT_PASSWORD" --silent > /dev/null 2>&1; do sleep 2; done; exec mysql -uroot -p"$$MYSQL_ROOT_PASSWORD" -e "DROP DATABASE IF EXISTS \`$${DB_NAME:-medialist_db}\`; CREATE DATABASE \`$${DB_NAME:-medialist_db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"'
	$(DOCKER_COMPOSE) exec -T mysql sh -lc 'exec mysql -uroot -p"$$MYSQL_ROOT_PASSWORD"' < "$(DUMP_FILE)"
	@printf "Dump restaurado a partir de: %s\n" "$(DUMP_FILE)"

backend-dev:
	$(DOCKER_COMPOSE) up -d mysql mongodb
	cd "$(BACKEND_DIR)" && $(PYTHON) app.py

frontend-dev:
	cd "$(FRONTEND_DIR)" && $(NPM) start

smoke-mysql:
	$(DOCKER_COMPOSE) up -d mysql
	$(DOCKER_COMPOSE) run --rm backend python test_mysql_connection.py

smoke-mongo:
	$(DOCKER_COMPOSE) up -d mongodb
	$(DOCKER_COMPOSE) run --rm backend python test_mongo.py

smoke-permissions:
	$(DOCKER_COMPOSE) up -d mysql mongodb
	$(DOCKER_COMPOSE) run --rm backend python test_permissions.py

smoke: smoke-mysql smoke-mongo smoke-permissions

test-backend:
	cd "$(BACKEND_DIR)" && $(PYTHON) -m pytest -q

test-frontend:
	cd "$(FRONTEND_DIR)" && CI=true $(NPM) test -- --watchAll=false

test-mobile:
	cd "$(MOBILE_DIR)" && $(NPM) test -- --ci

test: test-backend test-frontend test-mobile

build-frontend:
	cd "$(FRONTEND_DIR)" && $(NPM) run build

build: build-frontend

import-animes:
	$(DOCKER_COMPOSE) up -d mysql mongodb
	$(DOCKER_COMPOSE) run --rm backend python -m importacao.run_import --tipo anime --paginas 100 --workers $(IMPORT_WORKERS)

import-mangas:
	$(DOCKER_COMPOSE) up -d mysql mongodb
	$(DOCKER_COMPOSE) run --rm backend python -m importacao.run_import --tipo manga --paginas 100 --workers $(IMPORT_WORKERS)

import-jogos:
	$(DOCKER_COMPOSE) up -d mysql mongodb
	$(DOCKER_COMPOSE) run --rm backend python -m importacao.run_import --tipo jogo --paginas 100 --workers $(IMPORT_WORKERS)

import-all:
	$(DOCKER_COMPOSE) up -d mysql mongodb
	$(DOCKER_COMPOSE) run --rm backend python -m importacao.run_import --tipo todos --paginas 100 --workers $(IMPORT_WORKERS)

clean-frontend:
	rm -rf "$(FRONTEND_DIR)/build"
