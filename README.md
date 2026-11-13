# MediaList

Sistema full stack para catálogo, listas pessoais, avaliações e notícias de três tipos de mídia:

- animes
- mangás
- jogos

O projeto agora pode ser distribuído como um stack Docker completo, com frontend, backend e PostgreSQL orquestrados a partir de um único [docker-compose.yml](docker-compose.yml). Há também um app mobile em Expo, em [Mobile/](Mobile/README.md), que consome a mesma API.

## Visão geral

O MediaList começou como um sistema de animes e foi expandido para um modelo multimídia. A base relacional usa uma tabela central de `midias` com tabelas filhas específicas por tipo:

- `animes`
- `mangas`
- `jogos`

Além disso, o sistema oferece:

- autenticação com JWT
- controle de permissões por grupos
- lista pessoal por usuário
- avaliações e nota média agregada
- notícias e notificações de Atualização de mídia
- importação automática de catálogos externos
- alternância de sessão entre `animanga` e `jogos`

## Stack

### Backend

- Python 3
- Flask
- Gunicorn
- psycopg 3 + `psycopg_pool` (PostgreSQL, módulo `Backend/banco.py`)
- `flask-jwt-extended`

### Frontend

- React 19
- Create React App
- `lucide-react`
- Nginx para servir o build em produção

### Mobile

- Expo (React Native) com TypeScript
- Instruções em [Mobile/README.md](Mobile/README.md)

### Banco e serviços

- PostgreSQL 18, com migrações versionadas (Alembic): catálogo, Lista pessoal, notícias, notificações e preferências
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
│   ├── tests/
│   ├── requirements.txt
│   ├── requirements-dev.txt
│   └── test_*.py
├── Frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── public/
│   ├── src/
│   └── package.json
├── Mobile/
│   ├── app/
│   ├── src/
│   └── package.json
├── docs/adr/
├── .env.example
├── CONTEXT.md
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
- Node.js 18+ e npm (o Mobile exige Node 22.13+)

## Distribuição via Docker

### 1. Ajuste o ambiente, se necessário

Os defaults do projeto já funcionam sem arquivo adicional. Se quiser customizar portas, credenciais ou chaves, crie um `.env` a partir de [.env.example](.env.example).

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
- `postgres` em `localhost:5433` (`POSTGRES_PORT`)

Antes do backend, o serviço one-shot `migrate` roda `alembic upgrade head` com o usuário dono do banco
(migrações em [Backend/migrations](Backend/migrations)). Elas criam a estrutura e os dados estruturais minimos do sistema, sem catalogo pre-populado de midias.

### 3. Rebuild de imagens, quando necessário

```bash
make compose-build
```

Ou, de forma direta:

```bash
docker compose up --build -d
```

## Arquitetura de deploy

### Frontend

O frontend é buildado em [Frontend/Dockerfile](Frontend/Dockerfile) e servido por Nginx. O proxy reverso configurado em [Frontend/nginx.conf](Frontend/nginx.conf) encaminha `/api` para o backend, então a versão distribuída não depende de `localhost` hardcoded.

### Backend

O backend é empacotado em [Backend/Dockerfile](Backend/Dockerfile) e executado com Gunicorn, como usuário sem root (`app`, UID 1000). No Compose, ele conversa com:

- PostgreSQL em `postgres:5432`

### Banco de dados

O schema é versionado com Alembic em [Backend/migrations](Backend/migrations), em SQL puro. A baseline cria:

- tabelas centrais e especializadas, com FKs, CHECKs e UNIQUE
- triggers só de `data_atualizacao`
- views de leitura (inclusive `vw_notas_midia`, com Nota média e Total de avaliações)
- dados estruturais iniciais, como tipos, grupos de usuarios e generos

Usuários: o dono (`DB_OWNER_USER`) roda as migrações; o da aplicação (`DB_USER`) só tem
SELECT/INSERT/UPDATE/DELETE, criado por [docker/postgres-init](docker/postgres-init). O PostgreSQL só roda
esse init no primeiro start com volume vazio; num volume que já existe (usuário novo, grants perdidos),
`make db-grants` reaplica o mesmo script como dono, e pode rodar quantas vezes precisar.
Revisão nova: `make db-revision MSG="..."`; aplicar: `make db-migrate`.

O schema nao insere animes, mangas ou jogos de exemplo. O catalogo deve ser populado pelos importadores em [Backend/importacao](Backend/importacao).

## Desenvolvimento local

Se preferir rodar frontend e backend no host, mantendo só o PostgreSQL no Docker:

### 1. Instale as dependências locais

```bash
make install
```

### 2. Suba o PostgreSQL

```bash
docker compose up -d postgres
make db-migrate
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

- o backend local usa o PostgreSQL em `localhost:5433`
- o frontend local usa `http://localhost:5000/api` no modo desenvolvimento

## Comandos principais

O [Makefile](Makefile) centraliza os fluxos mais comuns.

| Comando | O que faz |
|---|---|
| `make services-up` | Sobe frontend, backend e PostgreSQL |
| `make compose-build` | Rebuilda as imagens Docker de backend e frontend |
| `make services-down` | Derruba os containers do stack |
| `make services-logs` | Mostra logs do Docker Compose |
| `make db-migrate` | Aplica as migrações pendentes (serviço `migrate`) |
| `make db-revision MSG=...` | Cria uma revisão nova em `Backend/migrations/versions` |
| `make db-shell` | Abre o `psql` dentro do container |
| `make db-grants` | Reaplica o usuário da aplicação e os grants num banco existente |
| `make db-dump` | Gera um dump (`pg_dump -Fc`) em `./dumps` |
| `make db-restore DUMP_FILE=...` | Restaura um dump com `pg_restore` |
| `make smoke-postgres` | Executa o smoke test de PostgreSQL no container backend |
| `make smoke-permissions` | Executa o smoke test de permissões no container backend |
| `make smoke` | Executa os dois smoke tests no container backend |
| `make import-animes` | Importa animes no container backend |
| `make import-mangas` | Importa mangás no container backend |
| `make import-jogos` | Importa jogos no container backend |
| `make import-all` | Executa todos os importadores no container backend |
| `make seed-dev` | Cria os dados de desenvolvimento (Usuários de dev, Lista, Avaliações, Notificações) |
| `make install` | Instala dependências locais para desenvolvimento sem Docker |
| `make backend-dev` | Inicia a API Flask no host |
| `make frontend-dev` | Inicia o frontend React no host |
| `make test` | Executa os testes do backend, do frontend e do mobile no host |
| `make test-backend` | Executa o pytest do backend no host |
| `make test-frontend` | Executa os testes do frontend no host |
| `make test-mobile` | Executa os testes do mobile no host |
| `make build-frontend` | Gera a build do frontend no host |

## Dados de desenvolvimento

`make seed-dev` roda o [Backend/seed_dev.py](Backend/seed_dev.py) no container backend e cria,
sem precisar de RAWG nem AniList: animes, mangás e jogos reais, os Usuários de dev, a Lista
pessoal do Usuário comum com todos os Estados de consumo de cada Tipo, Avaliações (há Nota
média), Notícias e Notificações (uma lida, outra não).

| Usuário | Senha | Grupo |
|---|---|---|
| `teste@medialist.dev` | `teste123` | Usuários |
| `admin@medialist.dev` | `admin123` | Administradores |
| `moderador@medialist.dev` | `moderador123` | Moderadores |

- Rodar de novo não duplica nada: o que já existe fica como está.
- `make seed-dev SEED_ARGS=--recriar` apaga e recria os três Usuários do seed e o que é deles;
  as Mídias e os dados de outros Usuários ficam.
- Combina com `make import-*` em qualquer ordem: as Mídias do seed usam os `anilist_id` e
  `rawg_slug` reais, e a Importação as atualiza no lugar.
- Recusa rodar com `APP_ENV=production`.

## Importação de dados externos

Os importadores ficam em [Backend/importacao](Backend/importacao).

Depois de subir o projeto com banco vazio, rode a importacao para popular o catalogo. Sem esse passo, o sistema inicia corretamente, mas sem midias cadastradas.

### Fontes

- AniList GraphQL
  - animes
  - mangás
- RAWG
  - jogos

## Backup e restore do PostgreSQL

### Gerar dump

```bash
make db-dump
```

Por padrão, o arquivo é salvo em `./dumps/medialist_YYYYMMDD_HHMMSS.dump`.

Se quiser definir o nome manualmente:

```bash
make db-dump DUMP_FILE=$(pwd)/dumps/meu_dump.dump
```

### Restaurar dump

```bash
make db-restore DUMP_FILE=$(pwd)/dumps/meu_dump.dump
```

Observação:

- o restore apaga e recria os objetos do dump (`pg_restore --clean`) no banco `DB_NAME`;
- isso sobrescreve o conteúdo atual do banco PostgreSQL do projeto.
### Entrypoints

Via `make`:

```bash
make import-animes
make import-mangas
make import-jogos
make import-all
```

Via execução direta no container:

```bash
docker compose run --rm backend python -m importacao.run_import --tipo anime --paginas 10
docker compose run --rm backend python -m importacao.run_import --tipo manga --paginas 10
docker compose run --rm backend python -m importacao.run_import --tipo jogo --paginas 10
docker compose run --rm backend python -m importacao.run_import --tipo todos --paginas 10
```

### Variáveis importantes

As configurações são lidas de [Backend/config.py](Backend/config.py) e [Backend/importacao/config.py](Backend/importacao/config.py).

Você pode sobrescrever por ambiente no Compose:

```bash
DB_NAME=medialist_db
DB_USER=media_app_user
DB_PASSWORD='MediaList@2025!Secure'
RAWG_API_KEY='sua-chave'
```

Observações:

- AniList não exige chave
- RAWG exige `RAWG_API_KEY`

## API

### Autenticação

- `POST /api/auth/registro`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `POST /api/auth/esqueci-senha`
- `POST /api/auth/redefinir-senha`
- `GET /api/auth/me`

### Mídias

- `GET /api/midias?tipo=anime`
- `GET /api/midias?tipo=manga`
- `GET /api/midias?tipo=jogo`
- `GET /api/midias/<id_midia>`
- `PUT /api/midias/<id_midia>`
- `DELETE /api/midias/<id_midia>`
- `POST /api/midias/<id_midia>/atualizacoes`
- `GET /api/midias/<id_midia>/distribuicao`
- `GET /api/midias/trending`

### Lista e avaliações

- `GET /api/lista`
- `POST /api/lista`
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
