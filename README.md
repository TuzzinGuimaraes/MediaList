# MediaList

Sistema full stack para catálogo, listas pessoais, avaliações e notícias de quatro tipos de mídia:

- animes
- mangás
- jogos
- músicas

O projeto agora pode ser distribuído como um stack Docker completo, com frontend, backend, MySQL e MongoDB orquestrados a partir de um único [docker-compose.yml](/home/artur/anilist/Projeto_LabBancoDados/docker-compose.yml).

## Visão geral

O MediaList começou como um sistema de animes e foi expandido para um modelo multimídia. A base relacional usa uma tabela central de `midias` com tabelas filhas específicas por tipo:

- `animes`
- `mangas`
- `jogos`
- `musicas`

Além disso, o sistema oferece:

- autenticação com JWT
- controle de permissões por grupos
- lista pessoal por usuário
- avaliações e nota média agregada
- notificações e notícias com MongoDB
- importação automática de catálogos externos

## Stack

### Backend

- Python 3
- Flask
- Gunicorn
- `mysql-connector-python`
- `flask-jwt-extended`
- PyMongo

### Frontend

- React 19
- Create React App
- `lucide-react`
- Nginx para servir o build em produção

### Banco e serviços

- MySQL 8
- MongoDB
- mongo-express opcional via profile de desenvolvimento
- Docker Compose na raiz para toda a stack

## Estrutura do projeto

```text
.
├── Backend/
│   ├── Dockerfile
│   ├── app.py
│   ├── config.py
│   ├── database.py
│   ├── importacao/
│   ├── repositories/
│   ├── routes/
│   ├── schemas/
│   └── test_*.py
├── Frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── public/
│   ├── src/
│   └── package.json
├── .env.example
├── Banco DDL.sql
├── docker-compose.yml
├── Makefile
└── README.md
```

## Requisitos

Para usar o stack completo com Docker, você só precisa de:

- Docker
- Docker Compose

Para desenvolvimento local sem containerizar frontend/backend:

- Python 3.10+
- Node.js 18+ e npm

## Distribuição via Docker

### 1. Ajuste o ambiente, se necessário

Os defaults do projeto já funcionam sem arquivo adicional. Se quiser customizar portas, credenciais ou chaves, crie um `.env` a partir de [.env.example](/home/artur/anilist/Projeto_LabBancoDados/.env.example).

Exemplo:

```bash
cp .env.example .env
```

### 2. Suba o stack principal

```bash
make services-up
```

Isso sobe:

- `frontend` em `http://localhost:3005`
- `backend` em `http://localhost:5000`
- `mysql` em `localhost:3308`
- `mongodb` em `localhost:27017`

Na primeira subida com volume vazio, o MySQL aplica automaticamente o schema de [Banco DDL.sql](/home/artur/anilist/Projeto_LabBancoDados/Banco%20DDL.sql).

### 3. Suba ferramentas auxiliares de desenvolvimento, se quiser

```bash
make services-up-dev
```

Esse comando habilita também:

- `mongo-express` em `http://localhost:8081`

### 4. Rebuild de imagens, quando necessário

```bash
make compose-build
```

Ou, de forma direta:

```bash
docker compose up --build -d
```

## Arquitetura de deploy

### Frontend

O frontend é buildado em [Frontend/Dockerfile](/home/artur/anilist/Projeto_LabBancoDados/Frontend/Dockerfile) e servido por Nginx. O proxy reverso configurado em [Frontend/nginx.conf](/home/artur/anilist/Projeto_LabBancoDados/Frontend/nginx.conf) encaminha `/api` para o backend, então a versão distribuída não depende de `localhost` hardcoded.

### Backend

O backend é empacotado em [Backend/Dockerfile](/home/artur/anilist/Projeto_LabBancoDados/Backend/Dockerfile) e executado com Gunicorn. No Compose, ele conversa com:

- MySQL em `mysql:3306`
- MongoDB em `mongodb:27017`

### Banco de dados

O schema principal está em [Banco DDL.sql](/home/artur/anilist/Projeto_LabBancoDados/Banco%20DDL.sql). Ele cria:

- database `medialist_db`
- usuário `media_app_user`
- tabelas centrais e especializadas
- triggers
- procedures
- views
- dados iniciais

## Desenvolvimento local

Se preferir rodar frontend e backend no host, mantendo apenas os bancos no Docker:

### 1. Instale as dependências locais

```bash
make install
```

### 2. Suba MySQL e MongoDB

```bash
docker compose up -d mysql mongodb
```

### 3. Rode o backend

```bash
make backend-dev
```

### 4. Rode o frontend

Em outro terminal:

```bash
make frontend-dev
```

Nesse modo:

- o backend local usa `localhost:3308` e `localhost:27017`
- o frontend local usa `http://localhost:5000/api` no modo desenvolvimento

## Comandos principais

O [Makefile](/home/artur/anilist/Projeto_LabBancoDados/Makefile) centraliza os fluxos mais comuns.

| Comando | O que faz |
|---|---|
| `make services-up` | Sobe frontend, backend, MySQL e MongoDB |
| `make services-up-dev` | Sobe o stack completo e habilita `mongo-express` |
| `make compose-build` | Rebuilda as imagens Docker de backend e frontend |
| `make services-down` | Derruba os containers do stack |
| `make services-logs` | Mostra logs do Docker Compose |
| `make db-schema` | Reaplica `Banco DDL.sql` no MySQL do Docker |
| `make db-shell` | Abre o cliente MySQL dentro do container |
| `make smoke-mysql` | Executa o smoke test de MySQL no container backend |
| `make smoke-mongo` | Executa o smoke test de MongoDB no container backend |
| `make smoke-permissions` | Executa o smoke test de permissões no container backend |
| `make import-animes` | Importa animes no container backend |
| `make import-mangas` | Importa mangás no container backend |
| `make import-jogos` | Importa jogos no container backend |
| `make import-musicas` | Importa músicas no container backend |
| `make import-all` | Executa todos os importadores no container backend |
| `make install` | Instala dependências locais para desenvolvimento sem Docker |
| `make backend-dev` | Inicia a API Flask no host |
| `make frontend-dev` | Inicia o frontend React no host |
| `make test-frontend` | Executa os testes do frontend no host |
| `make build-frontend` | Gera a build do frontend no host |

## Importação de dados externos

Os importadores ficam em [Backend/importacao](/home/artur/anilist/Projeto_LabBancoDados/Backend/importacao).

### Fontes

- AniList GraphQL
  - animes
  - mangás
- RAWG
  - jogos
- MusicBrainz + Cover Art Archive
  - músicas

### Entrypoints

Via `make`:

```bash
make import-animes
make import-mangas
make import-jogos
make import-musicas
make import-all
```

Via execução direta no container:

```bash
docker compose run --rm backend python -m importacao.run_import --tipo anime --paginas 10
docker compose run --rm backend python -m importacao.run_import --tipo manga --paginas 10
docker compose run --rm backend python -m importacao.run_import --tipo jogo --paginas 10
docker compose run --rm backend python -m importacao.run_import --tipo musica
docker compose run --rm backend python -m importacao.run_import --tipo todos --paginas 10
```

### Variáveis importantes

As configurações são lidas de [Backend/config.py](/home/artur/anilist/Projeto_LabBancoDados/Backend/config.py) e [Backend/importacao/config.py](/home/artur/anilist/Projeto_LabBancoDados/Backend/importacao/config.py).

Você pode sobrescrever por ambiente no Compose:

```bash
DB_NAME=medialist_db
DB_USER=media_app_user
DB_PASSWORD='MediaList@2025!Secure'
RAWG_API_KEY='sua-chave'
MB_USER_AGENT='MediaListApp/1.0 (seu_email@exemplo.com)'
```

Observações:

- AniList não exige chave
- RAWG exige `RAWG_API_KEY`
- MusicBrainz exige `MB_USER_AGENT` descritivo

## API

### Autenticação

- `POST /api/auth/registro`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Mídias

- `GET /api/midias?tipo=anime`
- `GET /api/midias?tipo=manga`
- `GET /api/midias?tipo=jogo`
- `GET /api/midias?tipo=musica`
- `GET /api/midias/<id_midia>`
- `PUT /api/midias/<id_midia>`
- `DELETE /api/midias/<id_midia>`
- `POST /api/midias/<id_midia>/atualizacoes`

### Rotas específicas por tipo

- `GET|POST /api/animes`
- `GET|PUT|DELETE /api/animes/<id>`
- `GET|POST /api/mangas`
- `GET /api/mangas/autor/<autor>`
- `GET /api/mangas/demografia/<demografia>`
- `GET|POST /api/jogos`
- `GET /api/jogos/plataforma/<plataforma>`
- `GET|POST /api/musicas`
- `GET /api/musicas/artista/<artista>`

### Lista e avaliações

- `GET /api/lista`
- `POST /api/lista/adicionar`
- `PUT /api/lista/<id_lista>`
- `PUT /api/lista/<id_lista>/progresso`
- `DELETE /api/lista/<id_lista>`
- `GET /api/avaliacoes/<id_midia>`
- `POST /api/avaliacoes`
- `PUT /api/avaliacoes/<id_avaliacao>`
- `DELETE /api/avaliacoes/<id_avaliacao>`

### Utilidades

- `GET /api/generos`
- `GET /api/notificacoes`
- `PUT /api/notificacoes/marcar-todas-lidas`
- `GET /api/health`
- `GET /api/midias/populares`
