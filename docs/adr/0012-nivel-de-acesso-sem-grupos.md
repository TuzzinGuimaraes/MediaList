# Nível de acesso por Usuário no lugar dos Grupos

O modelo de Grupos (duas tabelas, uma de Grupos e outra de associação, e quatro poderes por
Grupo: criar, editar, deletar e moderar) atrapalhava mais do que ajudava. Um Usuário
podia estar em vários Grupos e o efetivo era o mais privilegiado, o moderador tinha poderes
diferentes do admin e cada rota escolhia entre dois decoradores. Com poucos Usuários e um único
papel de fato usado, o admin, isso era complexidade sem uso.

Cada Usuário passa a ter um único **Nível de acesso**, `usuario` ou `admin`, na coluna
`usuarios.nivel_acesso` (CHECK, padrão `usuario`). O papel de moderador deixa de existir. Um
decorador só, `@admin_required`, guarda as rotas restritas: moderação de Avaliações e de
Usuários, Notícias, Atualizações de mídia e edição e exclusão de Mídias. A hierarquia fica:
ninguém ativa ou desativa a si mesmo, nem outro admin. Promover um Usuário a admin
fica no banco ou no seed: não há rota para isso.

No contrato, `permissoes` (login e `GET /usuario/permissoes`) fica só com `{nivel_acesso}`, e
`grupos` sai do Perfil e da lista da moderação, que ganham `nivel_acesso`.

A migração 0005 dá `admin` a quem estava em algum Grupo de Nível `admin` e `usuario` a todos os
outros, inclusive os moderadores, e apaga as duas tabelas. O downgrade recria as tabelas com um
Grupo por Nível (Administradores e Usuários).

## Considered Options

- **Manter os Grupos e só remover o moderador:** continua a composição entre Grupos e os
  poderes por coluna, que nenhuma regra usa.
- **Enum do PostgreSQL em vez de CHECK:** acrescentar um valor ao enum é mais rígido nas
  migrações; o CHECK em texto segue o ADR 0007 (regras na aplicação, banco só com o mínimo).

## Consequences

- Um terceiro Nível no futuro é mudança aditiva: um valor novo no CHECK e no `NivelAcesso`.
- Quem era moderador perde a moderação na migração, e o downgrade não a devolve.
- Rebaixar um admin não tem rota: um admin não muda o Nível de outro admin. Fica no banco.
