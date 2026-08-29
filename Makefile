.DEFAULT_GOAL := help

# Os diretórios são relativos de propósito, não derivados de $(CURDIR). O
# caminho absoluto do projeto pode conter espaços — 'C:\...\Área de Trabalho\'
# é o caso comum no Windows — e aí `cd /c/.../Área de Trabalho/MediaList/Backend`
# falha com "cd: too many arguments", porque o shell parte o caminho nos
# espaços. Caminho relativo não tem esse problema em lugar nenhum.
ROOT_DIR := $(CURDIR)
BACKEND_DIR := ./Backend
FRONTEND_DIR := ./Frontend
DUMP_DIR := ./dumps

# Interpretador Python. Nem todo `python3` no PATH serve: no Windows com MSYS2
# instalado, `python3` resolve para um Python sem pip. Por isso a escolha é por
# capacidade (tem pip?) e não por nome, nesta ordem:
#   1. venv do projeto, se existir      2. py -3 (launcher do Windows)
#   3. python3                          4. python
#
# ATENÇÃO: as receitas que usam $(PYTHON)/$(PIP) fazem `cd "$(BACKEND_DIR)"`
# antes, então o caminho do venv é relativo a Backend/, não à raiz.
#
# $(PYTHON), $(PIP) e $(NPM) NÃO levam aspas nas receitas: o valor pode ser
# `py -3`, ou seja, comando mais argumento, e aspas o transformariam num nome de
# executável inexistente. Aspas são para os diretórios, não para os comandos.
# Sobrescreva quando precisar: make install PYTHON=/caminho/para/python
ifeq ($(origin PYTHON), undefined)
PYTHON := $(shell \
	if [ -x "$(BACKEND_DIR)/.venv/Scripts/python.exe" ]; then echo "./.venv/Scripts/python.exe"; \
	elif [ -x "$(BACKEND_DIR)/.venv/bin/python" ]; then echo "./.venv/bin/python"; \
	elif command -v py >/dev/null 2>&1 && py -3 -c "import pip" >/dev/null 2>&1; then echo "py -3"; \
	elif command -v python3 >/dev/null 2>&1 && python3 -c "import pip" >/dev/null 2>&1; then echo "python3"; \
	elif command -v python >/dev/null 2>&1 && python -c "import pip" >/dev/null 2>&1; then echo "python"; \
	else echo "python3"; fi)
endif

PIP ?= $(PYTHON) -m pip

# No Windows existem dois "npm" no PATH: `npm.cmd` (nativo) e `npm`, um script
# `#!/usr/bin/env bash`. Um shell POSIX escolhe o script, e se `bash` resolver
# para o launcher do WSL o comando morre em `execvpe(/bin/bash) failed`.
# Preferir `npm.cmd` quando ele existe evita esse desvio.
#
# A detecção é por execução, não por `command -v`: o shell do MSYS executa
# arquivos .cmd mas não os encontra em `command -v`, que só considera .exe.
ifeq ($(origin NPM), undefined)
NPM := $(shell if npm.cmd --version >/dev/null 2>&1; then echo npm.cmd; else echo npm; fi)
endif

DOCKER_COMPOSE ?= docker compose
IMPORT_WORKERS ?= 8
DUMP_NAME ?= medialist_$(shell date +%Y%m%d_%H%M%S).sql
DUMP_FILE ?= $(DUMP_DIR)/$(DUMP_NAME)

.PHONY: help install install-backend install-frontend compose-build services-up services-up-dev \
	services-down services-logs db-schema db-shell backend-dev frontend-dev smoke-mysql \
	smoke-mongo smoke-permissions test-backend test-frontend test build-frontend build \
	import-animes import-mangas import-jogos import-all clean-frontend db-dump db-restore

help:
	@printf "\nMediaList - comandos principais\n\n"
	@printf "  make services-up       Sobe frontend, backend, MySQL e MongoDB via Docker\n"
	@printf "  make services-up-dev   Sobe o stack completo e habilita mongo-express\n"
	@printf "  make compose-build     Rebuilda as imagens Docker de backend e frontend\n"
	@printf "  make db-schema         Reaplica Banco DDL.sql no MySQL do Docker\n"
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
	@printf "  make test-frontend     Executa os testes do frontend no host\n"
	@printf "  make build-frontend    Gera a build do frontend no host\n"
	@printf "  make services-logs     Mostra logs do Docker Compose\n"
	@printf "  make services-down     Derruba os containers do stack\n"
	@printf "\nVariáveis úteis no Docker: BACKEND_PORT, FRONTEND_PORT, MYSQL_PORT, MONGO_PORT, RAWG_API_KEY, IMPORT_WORKERS\n\n"

install: install-backend install-frontend

install-backend:
	cd "$(BACKEND_DIR)" && $(PIP) install -r requirements.txt

install-frontend:
	cd "$(FRONTEND_DIR)" && $(NPM) install

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

test-backend: smoke-mysql smoke-mongo smoke-permissions

test-frontend:
	cd "$(FRONTEND_DIR)" && $(NPM) test -- --watchAll=false

test: test-frontend

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
