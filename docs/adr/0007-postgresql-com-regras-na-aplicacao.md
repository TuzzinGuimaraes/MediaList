# PostgreSQL no lugar de MySQL e MongoDB, com a regra de negócio na aplicação

O MediaList usava MySQL 8 para o modelo relacional e MongoDB para Notícias, Atualizações de mídia, Notificações e preferências. Passa a usar **um único PostgreSQL 18**. As quatro coleções do Mongo viram tabelas, e as preferências viram uma coluna JSONB em `usuarios`.

Junto com a troca, a regra de negócio sai do banco: geração de IDs, recálculo da Nota média e upsert da Importação, que hoje estão em triggers, functions e procedures, vão para a aplicação. No banco ficam FKs, CHECKs e UNIQUE, mais triggers de `updated_at` e views de leitura. Isso estende ao resto do sistema a decisão do ADR 0004 (autoria do Estado de consumo na aplicação).

O Backend acessa o banco com SQL cru via psycopg 3 e `psycopg_pool`. As migrações usam Alembic, por enquanto com SQL puro. A intenção declarada é adotar o SQLAlchemy ORM numa atualização futura, e o Alembic evita trocar de ferramenta e de histórico quando isso acontecer.

## Considered Options

- **Ficar no MySQL.** Custo zero de migração, mas mantém dois bancos no deploy e regras espalhadas em triggers.
- **PostgreSQL mantendo o Mongo.** Menos trabalho agora, mas mantém um segundo serviço para coleções pequenas e com formato fixo.
- **Portar as triggers e procedures como estão.** Preserva o comportamento atual, inclusive o conflito de dois autores na Nota média (ticket 13).
- **dbmate para migrações.** Mais leve, mas exigiria trocar de ferramenta no dia do ORM.

## Consequences

- A troca é feita de uma vez, sem convivência dos dois bancos e sem migrar dados: o catálogo volta pela Importação e os dados de teste pelo seed.
- `GROUP_CONCAT`, `FIND_IN_SET`, `INSERT IGNORE` e os `callproc` do Backend são reescritos.
- O deploy fica com um serviço de banco a menos.
