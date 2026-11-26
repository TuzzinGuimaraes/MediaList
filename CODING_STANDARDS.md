# Padrões de código do MediaList

Fonte do eixo **Standards** da skill `code-review`. Aqui ficam só regras de julgamento. O que é
mecânico já é cobrado pelo CI (`.github/workflows/ci.yml`) e não deve virar achado de revisão:
ruff, `tsc -b`/`typecheck`, eslint com `--max-warnings=0`, contrato OpenAPI regerado sem diff,
actionlint e shellcheck nos workflows.

Cada regra aponta para a decisão que a sustenta. Se a regra e o ADR divergirem, vale o ADR.

## Domínio e nomes

- Use os termos do `CONTEXT.md` no código, nas mensagens e nos testes, com o mesmo nome
  (Item de lista, Estado de consumo, Progresso, Nota pessoal, Nota da fonte...). Conceito novo ou
  renomeado entra no `CONTEXT.md` no mesmo PR.
- O código é em português, como o resto do repo. Não misture sinônimos para o mesmo conceito.
- Recorte de catálogo é estado de interface: não vai para o backend nem para a conta
  (`CONTEXT.md`, Recorte de catálogo).

## Regra de negócio

- A regra de negócio fica na aplicação. No banco entram só FK, CHECK, UNIQUE, triggers de
  `updated_at` e views de leitura. Trigger, function ou procedure com regra é achado (ADR 0004, 0007).
- Cada dado tem um único autor:
  - Estado de consumo e Progresso: só `Backend/dominio/lista_pessoal.py`, uma escrita por
    requisição (ADR 0004, 0009).
  - Rótulo de estado por Tipo: validado em `Backend/schemas/estado_consumo.py` (ADR 0002).
  - Nota média: calculada na leitura a partir das Avaliações, separada da Nota da fonte (ADR 0010).
  - Nota pessoal e Avaliação são coisas distintas; não unifique (ADR 0001).
- Recontagem é um contador, sem histórico (ADR 0003). Histórico novo precisa de ADR.
- Importação e Integrações nunca apagam trabalho do Usuário: Progresso fica com o maior valor,
  notas pessoais e Avaliações não são tocadas, Zerado e Platinado nunca são automáticos (ADR 0015).
- Dado vindo de fonte externa (AniList, RAWG, MAL, Steam) é validado antes de gravar: URL de capa
  só `https://` de host conhecido, texto com teto, sem palpite no casamento (ADR 0015).

## Backend

- Camadas: `routes/` cuida de HTTP e contrato, `dominio/` das regras e `repositories/` do SQL.
  Há SQL legado em algumas rotas; SQL novo de uma entidade que já tem repository vai nele.
- SQL cru com psycopg 3 e parâmetros (`%s`/`%(nome)s`). Valor de entrada nunca entra no texto da
  query; f-string só para trechos fixos montados pelo próprio código (ADR 0007).
- Toda rota declara entrada e saída com Pydantic no SpecTree, e os erros que devolve (as
  autenticadas somam `ERROS_AUTENTICADA`). Modelos em `Backend/schemas/<blueprint>.py`,
  formatos comuns em `Backend/contrato.py` (ADR 0011).
- Erro sempre `{erro, codigo, detalhes?}`. Entrada inválida responde 400 `dados_invalidos`, sem
  cair num padrão silencioso (ADR 0011).
- Lista paginada usa `Pagina[T]` (ADR 0011).
- Permissão por Nível de acesso com `admin_required`; não reintroduza Grupos (ADR 0012).
- Migração Alembic nova não reescreve a anterior e tem teste `test_migracao_*_pg.py` quando mexe
  em dado existente.

## Web e Mobile

- Tipos da API vêm de `contrato/api.d.ts`. Tipo de resposta escrito à mão é achado (ADR 0011).
- O app é só para o Usuário comum: admin e moderação ficam no web (ADR 0005).
- Mudança no app que exige código nativo sobe `version` no `app.json` e pede APK novo; o resto vai
  por EAS Update. O app nunca chama rota que ainda não está em produção (ADR 0014).
- Web e API no mesmo domínio: sem CORS em produção, refresh em cookie `httpOnly`, CSP com
  `connect-src 'self'` (ADR 0006, 0013). Header ou CSP novo vai no `vercel.json` e no `nginx.conf`.

## Segurança

- Segredo só em variável de ambiente ou secret do GitHub. Nunca em código, log, fixture ou
  saída de teste. Nada do `.env.producao` entra no repo.
- Rota autenticada respeita a Senha temporária (403 `troca_de_senha_obrigatoria`) salvo as
  exceções do ADR 0011.

## Testes

- Comportamento novo vem com teste, de preferência escrito antes (skill `tdd`).
- Regra que depende do banco (constraint, transação, migração) é testada contra PostgreSQL de
  verdade, em `*_pg.py`. Mock do banco não prova essas regras.
- Teste descreve comportamento visível (rota, função de domínio, tela), não detalhe interno.
