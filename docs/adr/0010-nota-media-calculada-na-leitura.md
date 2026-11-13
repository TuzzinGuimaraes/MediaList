# Nota média calculada na leitura, separada da Nota da fonte

A **Nota média** tinha dois autores que se sobrescreviam. A Importação gravava em
`midias.nota_media` a nota do AniList ou da RAWG, e triggers de `avaliacoes` trocavam esse valor
pela média das Avaliações. A primeira Avaliação apagava a nota da fonte, apagar a última gravava
0.00 e reimportar apagava a média. O `CONTEXT.md` já dizia que a Nota média deriva só das
Avaliações.

Com a troca para o PostgreSQL (ADR 0007), a Nota média e o Total de avaliações deixam de ser
gravados: a view `vw_notas_midia` os calcula a partir de `avaliacoes` em cada leitura, e os dois
são NULL quando a Mídia não tem Avaliações. A nota externa vai para uma coluna própria,
`midias.nota_fonte`, gravada só pela Importação. Ela é a **Nota da fonte**, que aparece na tela
com rótulo próprio ("Nota AniList", "Nota RAWG"), nunca como Nota média. As respostas da API
trazem `nota_fonte` e `origem_nota` junto com `nota_media`.

A ordenação por nota usa `COALESCE(nota_media, nota_fonte)`: com poucos Usuários, quase nenhuma
Mídia tem Avaliação, e ordenar só pela Nota média deixaria o Catálogo empatado.

As três notas (Avaliação, Nota pessoal e Nota da fonte) vão de 0 a 10, com uma casa decimal
(`numeric(3,1)`, com CHECK). O `DECIMAL(3,2)` antigo não guardava 10.

## Considered Options

- **Aplicação grava `nota_media` na transação da Avaliação:** um autor só, mas o valor guardado
  pode ficar desatualizado se alguém escrever em `avaliacoes` por outro caminho. Fica como
  otimização caso a média na leitura pese.
- **Não guardar a nota da fonte:** sem Avaliações, o Catálogo ficaria sem nenhuma referência de
  qualidade.

## Consequences

- Toda consulta que mostra a Nota média faz join com `vw_notas_midia`, que conta com um índice
  em `avaliacoes(id_midia)`.
- A Nota da fonte vira termo do `CONTEXT.md`.
