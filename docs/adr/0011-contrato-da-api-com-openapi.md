# Contrato da API com OpenAPI gerado do Backend e tipos TS gerados

A API tem três consumidores (web, app e testes) e cada um tinha os tipos escritos à mão. Houve
bugs de contrato (`nome_genero`, Decimal saindo como string, datas), a paginação não dizia o
total e o erro vinha às vezes em `erro`, às vezes em `msg` (flask-jwt). A validação de entrada
era um `BaseSchema` próprio.

O contrato passa a ser declarado no Backend com **SpecTree + Pydantic v2**, nos blueprints que
já existem. Cada rota declara a entrada (`query`, `json`) e a saída (`Response(HTTP_200=...)`)
com modelos Pydantic; o SpecTree valida e gera o OpenAPI. O Pydantic substitui o `BaseSchema`.
A instância única, os formatos comuns e os envelopes ficam em `Backend/contrato.py`; os modelos
de cada blueprint, em `Backend/schemas/<blueprint>.py`.

- **Tipos TS:** `make api-tipos` exporta o OpenAPI sem subir o servidor
  (`Backend/exportar_openapi.py` → `contrato/openapi.json`) e gera `contrato/api.d.ts` com o
  `openapi-typescript` em versão fixa. Os dois arquivos entram no git; o CI regera e falha se
  houver diferença. O app troca o `tipos.ts` pelo arquivo gerado; o web adota quando virar TS.
  Os clientes HTTP atuais continuam.
- **Erro:** `{erro, codigo, detalhes?}` em toda resposta de erro, inclusive nos loaders do
  flask-jwt (o `msg` acaba). `erro` é a mensagem para a tela; `codigo` é o enum `CodigoErro`
  do OpenAPI; `detalhes` é `{campo: motivo}` nos erros de validação. As mensagens do Pydantic
  são traduzidas nos tipos comuns (obrigatório, tipo, intervalo, valor não permitido); o resto
  vira "Valor inválido". Valor de entrada inválido, na query ou no corpo, responde 400
  `dados_invalidos`, inclusive os que antes eram ignorados ou caíam num padrão (Tipo ou ordem
  desconhecidos, `refresh_token` que não é texto, `?nao_lidas=` inválido).
- **Erros declarados:** cada rota declara os erros que devolve. As autenticadas somam
  `ERROS_AUTENTICADA` (401, o 403 `troca_de_senha_obrigatoria` e o 422 do token malformado), que
  já cobre o 403 das com `admin_required` (ADR 0012); `ERROS_COM_PERMISSAO` é o mesmo conjunto.
  Os dois ficam em `contrato.py`.
- **Senha temporária (spec `producao`):** login e `GET /auth/me` devolvem `deve_trocar_senha`, e
  o access token de quem entrou com uma Senha temporária leva o claim `deve_trocar_senha` (o
  refresh mantém). Enquanto a flag do Usuário estiver no banco, toda rota autenticada responde
  403 `troca_de_senha_obrigatoria`, salvo `/auth/trocar-senha`, `/auth/me` e `/auth/logout`; vale
  a flag do banco, então um access emitido antes da redefinição também fica preso.
  `POST /auth/trocar-senha {senha_atual, nova_senha}` serve a qualquer Usuário: senha atual
  errada ou nova igual à atual respondem 400 `dados_invalidos` com `detalhes`, a nova segue o
  mínimo do registro (6), e a troca encerra as outras sessões, revoga o access usado e devolve
  `{access_token, refresh_token}` (no web, o refresh no cookie).
- **Paginação:** `Pagina[T]` = `{itens, pagina, por_pagina, total}` em `GET /midias`, nas
  Avaliações de uma Mídia, nas Notícias e nos Usuários da moderação. Lista pessoal, gêneros,
  trending, populares e Notificações ficam sem paginação.
- **Notas de uma Mídia:** `GET /midias/<id>/notas` traz a distribuição das notas das Avaliações
  (faixas de 1 a 10, a nota arredondada) e a Avaliação do Usuário logado, ou null sem login.
  Assim os clientes buscam só a 1ª página das Avaliações, em vez de todas para montar o gráfico
  e achar a própria.
- **Filtro por ano:** `GET /midias` aceita `ano_min` e `ano_max` (inteiros de 1 a 9999,
  inclusive, sobre o ano da `data_lancamento`); Mídia sem data fica fora quando há filtro de ano.
  O `total` conta só as que passam no filtro.
- **Atividade de uma Mídia:** `GET /midias/<id>/atividade` devolve
  `{dias: [{data, total}], inicio, fim}`: quantas adições à Lista (`data_adicao`), Avaliações
  (`data_avaliacao`) e conclusões (`data_conclusao`) houve em cada dia das últimas 52 semanas
  (364 dias, `fim` é hoje). Só saem os dias com atividade, em ordem; 404 se a Mídia não existe.
  Hoje e o dia de cada instante seguem o fuso da sessão do banco.
- **Facetas do catálogo:** `GET /midias/facetas?tipo=` devolve `{plataformas, estudios}`, os
  valores distintos e ordenados dos filtros `plataforma` e `estudio` de `GET /midias`, para os
  clientes oferecerem opções em vez de texto livre. Plataformas só nos jogos, estúdios só nos
  animes; o que não se aplica ao Tipo vem vazio, e sem Tipo vêm os dois.
- **Ping:** `GET /ping` é público e responde 200 `{status: 'ok'}` sem tocar no banco, para o
  monitor externo não manter a Neon acordada (ADR-0013). O `GET /health` segue medindo o
  PostgreSQL (503 sem ele).
- **Formatos:** notas como `number`, IDs como `string`, datas `YYYY-MM-DD`, instantes ISO 8601
  com fuso. A resposta sai serializada pelo modelo: campo fora do modelo não sai. Campo sem
  leitor no web e no app sai do contrato, seja legado ou dado de domínio (cada um listado no
  PR). O banco mantém tudo, e voltar com um campo é uma mudança aditiva.
- **Validação das respostas:** nos testes (`CONTRATO_RESPOSTA_ESTRITA`, ligada no `conftest`)
  uma resposta fora do modelo vira 500 e o teste falha. Em produção a resposta original sai e o
  desvio vai para o log. O SpecTree sozinho sempre troca a resposta inválida por 500, então o
  modo só-log é um plugin próprio (`PluginContrato`).
- **Docs:** `/api/docs` (Swagger), `/api/docs/redoc/` e `/api/openapi.json` só fora de produção.
- **Versionamento:** sem prefixo de versão na URL. Depois do app em produção (ticket 22 da
  revisão), só mudanças aditivas; uma quebra exige um período em que o campo velho e o novo
  convivem.

Revoga a decisão da spec mobile-v1 (Q11) de tipos escritos à mão no app, com OpenAPI fora do
escopo, e ajusta o ADR 0005.

## Considered Options

- **apispec + marshmallow:** maduro, mas são dois esquemas (marshmallow para validar, apispec
  para documentar) e o marshmallow não é o Pydantic que o resto do ecossistema usa.
- **flask-smorest:** traz blueprints próprios e marshmallow; trocaria a estrutura das rotas.
- **Tipos à mão com testes de contrato:** sem dependência nova, mas os três consumidores
  continuariam divergindo, que é o problema.
- **Validar a resposta também em produção (500):** pega o desvio na hora, mas derruba uma tela
  por um campo a mais ou a menos. O log basta, porque os testes já falham.

## Consequences

- Toda rota nova ou alterada declara entrada e saída; sem isso ela não aparece no OpenAPI
  (modo `strict` do SpecTree) nem nos tipos.
- Mudou a API ⇒ `make api-tipos` e commitar `contrato/`. Em merges com conflito em `contrato/`,
  basta regerar.
- Toda resposta declarada é validada e serializada pelo Pydantic; custo aceito pelo tamanho
  das respostas.
