# Recontagem é contada, não historiada

`lista_usuarios` tem uma linha por par usuário/mídia, com um único par
`data_inicio`/`data_conclusao` e um contador `total_rewatches`. Reassistir, reler ou
rejogar incrementa o contador e sobrescreve as datas: o sistema sabe *quantas vezes*,
não *quando cada vez*.

Modelar histórico de verdade exigiria uma tabela de passagens e a reescrita das
estatísticas e views de perfil, desproporcional ao valor. Consequência que precisa
estar explícita porque o schema sugere o contrário: as datas de um item recontado
descrevem a passagem mais recente, não a primeira.
