.DEFAULT_GOAL := help

PYTHON ?= python3
PIP ?= $(PYTHON) -m pip
NPM ?= npm
DOCKER_COMPOSE ?= docker compose
IMPORT_WORKERS ?= 8

ROOT_DIR := $(CURDIR)
BACKEND_DIR := $(ROOT_DIR)/Backend
FRONTEND_DIR := $(ROOT_DIR)/Frontend

.PHONY: help install install-backend install-frontend compose-build services-up services-up-dev \
	services-down services-logs db-schema db-shell backend-dev frontend-dev smoke-mysql \
	smoke-mongo smoke-permissions test-backend test-frontend test build-frontend build \
	import-animes import-mangas import-jogos import-musicas import-all clean-frontend

help:
	@printf "\nMediaList - comandos principais\n\n"
	@printf "  make services-up       Sobe frontend, backend, MySQL e MongoDB via Docker\n"
	@printf "  make services-up-dev   Sobe o stack completo e habilita mongo-express\n"
	@printf "  make compose-build     Rebuilda as imagens Docker de backend e frontend\n"
	@printf "  make db-schema         Reaplica Banco DDL.sql no MySQL do Docker\n"
	@printf "  make db-shell          Abre o cliente MySQL dentro do container\n"
	@printf "  make smoke-mysql       Executa o smoke test de MySQL no container backend\n"
	@printf "  make smoke-mongo       Executa o smoke test de MongoDB no container backend\n"
	@printf "  make smoke-permissions Executa o script de permissões no container backend\n"
	@printf "  make import-animes     Importa animes no container backend\n"
	@printf "  make import-mangas     Importa mangás no container backend\n"
	@printf "  make import-jogos      Importa jogos no container backend com concorrência limitada\n"
	@printf "  make import-musicas    Importa músicas no container backend com concorrência limitada\n"
	@printf "  make import-all        Executa todos os importadores no container backend\n"
	@printf "  make install           Instala dependências locais para desenvolvimento sem Docker\n"
	@printf "  make backend-dev       Inicia a API Flask no host em http://localhost:5000\n"
	@printf "  make frontend-dev      Inicia o React no host em http://localhost:3005\n"
	@printf "  make test-frontend     Executa os testes do frontend no host\n"
	@printf "  make build-frontend    Gera a build do frontend no host\n"
	@printf "  make services-logs     Mostra logs do Docker Compose\n"
	@printf "  make services-down     Derruba os containers do stack\n"
	@printf "\nVariáveis úteis no Docker: BACKEND_PORT, FRONTEND_PORT, MYSQL_PORT, MONGO_PORT, RAWG_API_KEY, MB_USER_AGENT, IMPORT_WORKERS\n\n"

install: install-backend install-frontend

install-backend:
	cd $(BACKEND_DIR) && $(PIP) install -r requirements.txt

install-frontend:
	cd $(FRONTEND_DIR) && $(NPM) install

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
	$(DOCKER_COMPOSE) exec -T mysql sh -lc 'until mysqladmin ping -h 127.0.0.1 -uroot -p"$$MYSQL_ROOT_PASSWORD" --silent; do sleep 2; done; exec mysql -uroot -p"$$MYSQL_ROOT_PASSWORD"' < "$(ROOT_DIR)/Banco DDL.sql"

db-shell:
	$(DOCKER_COMPOSE) up -d mysql
	$(DOCKER_COMPOSE) exec mysql sh -lc 'exec mysql -uroot -p"$$MYSQL_ROOT_PASSWORD"'

backend-dev:
	$(DOCKER_COMPOSE) up -d mysql mongodb
	cd $(BACKEND_DIR) && $(PYTHON) app.py

frontend-dev:
	cd $(FRONTEND_DIR) && $(NPM) start

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
	cd $(FRONTEND_DIR) && $(NPM) test -- --watchAll=false

test: test-frontend

build-frontend:
	cd $(FRONTEND_DIR) && $(NPM) run build

build: build-frontend

import-animes:
	$(DOCKER_COMPOSE) up -d mysql mongodb
	$(DOCKER_COMPOSE) run --rm backend python -m importacao.run_import --tipo anime --paginas 200 --workers $(IMPORT_WORKERS)

import-mangas:
	$(DOCKER_COMPOSE) up -d mysql mongodb
	$(DOCKER_COMPOSE) run --rm backend python -m importacao.run_import --tipo manga --paginas 200 --workers $(IMPORT_WORKERS)

import-jogos:
	$(DOCKER_COMPOSE) up -d mysql mongodb
	$(DOCKER_COMPOSE) run --rm backend python -m importacao.run_import --tipo jogo --paginas 200 --workers $(IMPORT_WORKERS)

import-musicas:
	$(DOCKER_COMPOSE) up -d mysql mongodb
	$(DOCKER_COMPOSE) run --rm backend python -m importacao.run_import --tipo musica --workers $(IMPORT_WORKERS)

import-all:
	$(DOCKER_COMPOSE) up -d mysql mongodb
	$(DOCKER_COMPOSE) run --rm backend python -m importacao.run_import --tipo todos --paginas 200 --workers $(IMPORT_WORKERS)

clean-frontend:
	rm -rf $(FRONTEND_DIR)/build
