# Contexto: MediaList

Glossário do domínio do MediaList. Define os termos que o código, a API e as conversas
sobre o projeto devem usar. Não descreve implementação: para *como* algo é feito, leia o
código; para *por que* uma decisão foi tomada, leia `docs/adr/`.

O idioma canônico do domínio é o **português**. Rótulos em inglês que aparecem na interface
são texto de apresentação, não sinônimos (ver **Rótulo de estado**).

---

## Mídia

Uma obra do catálogo: um anime, um mangá ou um jogo. É a entidade que os usuários
acompanham, avaliam e colocam nas suas listas.

Toda Mídia tem exatamente um **Tipo de mídia** e existe uma única vez no catálogo,
independente de quantos usuários a acompanham. Título, sinopse, data de lançamento, pôster
e gêneros pertencem à Mídia; nada do que um usuário faz com ela pertence à Mídia.

A **Nota média** e o **Total de avaliações** são as únicas exceções: são propriedades da
Mídia derivadas das **Avaliações** que ela recebeu.

## Tipo de mídia

Uma das três naturezas de obra que o sistema conhece: `anime`, `manga`, `jogo`.

O Tipo determina quais atributos específicos a Mídia tem (episódios para anime, capítulos
e demografia para mangá, plataformas para jogo), quais **Gêneros** se aplicam a ela, e
quais **Rótulos de estado** são válidos na lista de um usuário.

O Tipo é imutável: uma Mídia não muda de tipo. A adaptação de um mangá em anime são duas
Mídias distintas, não uma que mudou.

## Catálogo

O conjunto de todas as Mídias conhecidas pelo sistema. O Catálogo é populado por
**Importação** a partir de fontes externas, não por cadastro manual de usuários comuns.

## Importação

O processo de trazer Mídias de uma fonte externa para o Catálogo. Uma Mídia importada
carrega o identificador da fonte de origem, o que torna a Importação repetível: reimportar
atualiza a Mídia existente em vez de duplicá-la.

## Recorte de catálogo

O agrupamento de Tipos de mídia que o usuário está visualizando no momento: `animanga`
(animes e mangás juntos) ou `jogos`.

**É estado de interface, não de domínio.** Não existe no backend, não é persistido na conta
do usuário e não altera o que está armazenado — apenas filtra o que a tela mostra. Duas
pessoas com Recortes diferentes veem o mesmo Catálogo.

> Não confundir com **sessão**, que neste projeto significa a sessão autenticada (login,
> token, logout). O Recorte de catálogo não tem relação com autenticação.

---

## Usuário

Uma pessoa cadastrada no sistema. Tem uma **Lista pessoal**, escreve **Avaliações** e
pertence a um ou mais **Grupos**.

## Grupo

Um conjunto de poderes atribuível a Usuários: criar, editar, deletar e moderar conteúdo do
Catálogo, mais um **Nível de acesso** (`admin`, `moderador`, `usuario`).

Um Usuário pode pertencer a vários Grupos ao mesmo tempo. Quando pertence a mais de um,
**vence o mais privilegiado**: o Usuário tem um poder se *qualquer* Grupo seu concede esse
poder, e o Nível de acesso efetivo é o mais alto entre os seus Grupos.

Um Usuário sem nenhum Grupo não tem poder algum. A ausência de Grupo nunca concede mais do
que a presença de um.

## Nível de acesso

A senioridade do Usuário, em ordem crescente: `usuario` < `moderador` < `admin`. Serve para
rotular a pessoa na interface e para conceder acesso irrestrito ao `admin`.

Não substitui os poderes individuais do **Grupo**: um moderador tem `pode_moderar` porque
seu Grupo concede, não porque seu Nível é `moderador`.

---

## Lista pessoal

O conjunto de Mídias que um Usuário acompanha. Cada Mídia aparece **no máximo uma vez** na
Lista de um Usuário, como um **Item de lista**.

A Lista pessoal é **pública por padrão**: faz parte do perfil do Usuário e existe para ser
vista por outros. Itens individuais podem ser marcados como **privados** e ficam ocultos
para todos menos o dono.

> Hoje o sistema não expõe listas de terceiros por nenhum caminho; a marcação de privacidade
> por item existe mas não é lida. Isso é uma funcionalidade pendente, não uma contradição do
> modelo.

## Item de lista

O vínculo entre um Usuário e uma Mídia: o registro de que aquela pessoa acompanha aquela
obra. Carrega o **Estado de consumo**, o **Progresso**, a **Nota pessoal**, se é favorito,
se é privado, as datas de início e conclusão, e um comentário particular.

Um Item de lista representa o **estado atual**, não o histórico. Ver **Recontagem**.

## Estado de consumo

Em que ponto do acompanhamento o Usuário está com aquela Mídia. São seis estados,
independentes de Tipo de mídia:

| Estado | Significado |
|---|---|
| **Planejado** | Pretende consumir, ainda não começou |
| **Em progresso** | Está consumindo agora |
| **Pausado** | Começou, parou temporariamente, pretende voltar |
| **Abandonado** | Começou, parou, não pretende voltar |
| **Concluído** | Chegou ao fim |
| **Platinado** | Concluído com completude total. Exclusivo de jogos |

**Platinado é um refinamento de Concluído**, não um sétimo estado paralelo: todo Item
platinado está concluído. Qualquer contagem de "concluídos" inclui os platinados.

## Rótulo de estado

O nome que um **Estado de consumo** recebe para um **Tipo de mídia** específico. O estado é
o mesmo; a palavra muda com o tipo da obra.

| Estado de consumo | anime | manga | jogo |
|---|---|---|---|
| Planejado | `planejado` | `planejado` | `na_fila` |
| Em progresso | `assistindo` | `lendo` | `jogando` |
| Pausado | `pausado` | `pausado` | `pausado` |
| Abandonado | `abandonado` | `abandonado` | `abandonado` |
| Concluído | `completo` | `lido` | `zerado` |
| Platinado | — | — | `platinado` |

Um Rótulo só é válido para o Tipo da Mídia do Item: um anime nunca está `platinado` nem
`jogando`.

Os textos em inglês da interface (`Current`, `Completed`, `Planning`, `Paused`, `Dropped`,
`Platinum`) são a tradução de apresentação do **Estado de consumo**, não Rótulos de estado
e não termos do domínio.

## Progresso

Quanto da Mídia o Usuário já consumiu, em unidades do Tipo: episódios para anime, capítulos
para mangá.

**Jogos não têm Progresso mensurável** — não existe uma contagem total contra a qual medir,
então um Item de jogo tem Estado de consumo mas não fração completada.

O Progresso nunca excede o total da Mídia. Atingir o total leva o Item a **Concluído**.

## Recontagem

Quantas vezes o Usuário reconsumiu uma Mídia depois de concluí-la pela primeira vez —
reassistir um anime, reler um mangá, rejogar um jogo.

**O sistema conta recontagens, não guarda o histórico delas.** Um Item de lista tem um único
par de datas de início e conclusão, sobrescrito a cada nova passagem. Consequência
deliberada: as datas de um Item recontado descrevem a passagem mais recente, não a primeira.

---

## Nota pessoal

A nota que o Usuário dá a uma Mídia dentro da sua **Lista pessoal**. É só um número, sem
texto, e pertence ao **Item de lista**.

Serve para o próprio Usuário: alimenta as estatísticas e a nota média do perfil dele. **Não
influencia a Nota média da Mídia.**

## Avaliação

A resenha pública que um Usuário escreve sobre uma Mídia: nota, título e texto. Recebe
curtidas e descurtidas de outros Usuários.

Cada Usuário escreve **no máximo uma** Avaliação por Mídia. As Avaliações de uma Mídia são
o que produz a sua **Nota média**.

> **Nota pessoal e Avaliação são conceitos distintos e podem divergir.** O mesmo Usuário
> pode ter Nota pessoal 9 e Avaliação 6 para a mesma Mídia: a primeira conta no perfil dele,
> a segunda na nota pública da obra. Não são sinônimos e não devem ser sincronizadas.

## Nota média

A média das notas das **Avaliações** de uma Mídia. É a nota pública da obra.

Deriva exclusivamente de Avaliações: uma Mídia que ninguém avaliou não tem Nota média, mesmo
que muitos Usuários tenham dado **Nota pessoal** a ela.

## Popularidade

Quantos Usuários têm a Mídia na sua **Lista pessoal**, em qualquer Estado de consumo.

Mede alcance, não qualidade — é independente da **Nota média**. Uma Mídia muito adicionada
e mal avaliada é popular.

---

## Notícia

Uma publicação editorial dirigida a todos os Usuários, escrita por quem tem poder de criar
conteúdo. Não pertence a nenhuma Mídia específica.

## Atualização de mídia

Um aviso vinculado a uma Mídia específica — episódio novo, capítulo novo, mudança de status
da obra. Diferente da **Notícia**, que é geral.

## Notificação

A entrega de uma **Atualização de mídia** a um Usuário, com a marca de lida ou não lida. A
Atualização é o fato; a Notificação é o fato chegando a alguém.
