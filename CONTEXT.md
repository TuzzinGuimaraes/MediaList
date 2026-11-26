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
Mídia derivadas das **Avaliações** que ela recebeu. A **Nota da fonte** também pertence à
Mídia, mas vem da Importação, não dos Usuários.

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

Cada execução retoma, por Tipo de mídia, de onde a anterior parou (o cursor da Importação),
em vez de recomeçar do início. Uma página que falha (ou o banco fora do ar no meio dela) não
avança o cursor e encerra aquele Tipo, para não abrir buracos; um item que falha sozinho não
derruba a página. Ao chegar ao fim da fonte, o cursor volta ao início e a Importação passa a
atualizar as Mídias já importadas.

No RAWG (jogos) o cursor é a próxima página, na ordem de popularidade do RAWG, sem teto: cresce
até a fonte acabar. Jogo sem capa ou sem data de lançamento é pulado (contado à parte, não é
falha). Antes de criar um jogo, a Importação procura entre os jogos que vieram da loja da Steam
(sem identificador do RAWG) um com o mesmo título (sem caixa, acento nem pontuação) e o mesmo
ano; se o RAWG confirmar a mesma `steam_appid` nas lojas do jogo, os dois são a mesma Mídia, que
ganha os dados do RAWG. O AniList (anime e mangá) não dá página acima de
100 (5000 obras por consulta), então tem duas passadas por Tipo, cada uma com o seu cursor:

- **Crescimento**, sem fim: segue a ordem de popularidade a partir da última obra importada
  (a **fronteira**: popularidade, id e quantas obras com essa popularidade já vieram), em
  janelas que nunca passam da página 100. As obras empatadas na popularidade da fronteira vêm
  antes das menos populares. No fim do AniList, recomeça do topo e atualiza as obscuras na volta.
- **Atualização das populares**: algumas páginas por dia (10 por padrão), em rodízio pelas
  páginas 1–100 por popularidade, para as 5000 mais populares não ficarem paradas.

Se o AniList recusar uma página pelo limite de páginas, é o fim da janela, não uma falha. Uma
obra que muda de popularidade entre execuções e pula a fronteira pode ficar de fora até a volta
seguinte (meses, nos mangás); as 5000 mais populares não sofrem com isso, porque a atualização
as cobre.

## Integração

A conta pública do Usuário numa plataforma externa (AniList, MyAnimeList, Steam), conectada
pelo nome de usuário ou pela URL do perfil, sem senha nem OAuth (ADR-0015). Importar por uma
Integração traz os itens da lista dele na plataforma para a **Lista pessoal**: primeiro uma
**prévia** (novos, atualizados e "Não encontrados"), que só grava ao confirmar. Confirmar é
tudo ou nada: falhou no meio, nenhum Item muda e a prévia continua valendo. Uma importação lê
no máximo 5000 itens da plataforma; lista maior é recusada (`lista_grande_demais`).

A Integração **nunca apaga trabalho do Usuário**: o Progresso fica com o maior valor, o Estado
de consumo só muda se o Progresso subiu, a nota da plataforma só entra onde não há Nota
pessoal, e comentário, favorito, Recontagem e Avaliações não são tocados (nem quando a
plataforma leva ao total um Item que já tinha conclusão: vira Concluído sem somar Recontagem). Em jogos, só as horas
(a maior) e `na_fila` → `jogando`; Zerado e Platinado nunca vêm da plataforma.

Obra da lista que falta no Catálogo entra por **Importação** sob demanda, da mesma fonte do
Catálogo (AniList para anime e mangá, RAWG para jogo). O que não casa com segurança fica em
**Não encontrados** (título e link), sem palpite; `idMal` que o AniList dá para mais de uma
obra também. O link só sai se for `https://` da própria plataforma (AniList, MyAnimeList, Steam, RAWG).

Da Steam vêm os jogos já abertos (`playtime_forever` > 0), com as horas arredondadas e no mínimo 1,
gravadas no `progresso_atual` como em todo jogo. Ela não tem prévia: **sincroniza** todo dia e por "Sincronizar agora"; jogo
ainda não casado com o Catálogo fica **pendente** para a próxima sincronização. Jogo que o RAWG
não reconhece entra pela loja da Steam (a Mídia guarda a `steam_appid`, e a Importação do RAWG
que trouxer a mesma appid atualiza essa Mídia em vez de criar outra); o que a loja diz que não é
jogo (software, DLC, trilha sonora) é ignorado, fora de "Não encontrados".

Um Não encontrado pode ser **vinculado** pelo próprio Usuário a uma Mídia do Catálogo do mesmo
Tipo (Steam só jogo; AniList e MAL, o anime ou o mangá do item). O **Vínculo** é global: vale na
hora para todo Usuário com o mesmo item na mesma plataforma, é reserva (só vale quando a fonte
não casa o item; nunca troca um casamento que a fonte fez) e já leva o Item para a Lista de quem
vinculou, pelas mesmas regras da importação. O
admin vê os Vínculos com autor e data e pode desfazer um errado; desfazer não apaga Itens, só faz
a próxima importação voltar a dar Não encontrado.

## Recorte de catálogo

O agrupamento de Tipos de mídia que o usuário está visualizando no momento: `animanga`
(animes e mangás juntos) ou `jogos`.

**É estado de interface, não de domínio.** Não existe no backend, não é persistido na conta
do usuário e não altera o que está armazenado — apenas filtra o que a tela mostra. Duas
pessoas com Recortes diferentes veem o mesmo Catálogo.

> Não confundir com **sessão**, que neste projeto significa a sessão autenticada (login,
> token, logout). O Recorte de catálogo não tem relação com autenticação.

Na interface aparece só como o valor ("Anime & Mangá", "Jogos"); a palavra Recorte não vai
para a tela, e o leitor de tela diz "Catálogo".

---

## Usuário

Uma pessoa cadastrada no sistema. Tem uma **Lista pessoal**, escreve **Avaliações** e
tem um único **Nível de acesso**.

## Senha temporária

A senha que o admin gera para um Usuário que esqueceu a dele (`make redefinir-senha
EMAIL=...`), já que o sistema não manda email. É aleatória, vale por 24 h e encerra as
sessões abertas do Usuário. Quem entra com ela só consegue trocar a senha ou sair da conta:
na interface aparece a tela "Defina sua nova senha", e a API recusa o resto com
`troca_de_senha_obrigatoria`. Vencida, não vale para nada: não entra nem serve para a
troca, como uma senha errada, e o admin gera outra.

Não confundir com a recuperação por token (`/auth/esqueci-senha`), que depende de email e
fica para o ticket 25.

## Nível de acesso

O que o Usuário pode fazer além do uso comum, em ordem crescente: `usuario` < `admin`. Todo
cadastro novo é `usuario`.

O `admin` pode tudo: moderar Avaliações, ativar ou desativar Usuários, criar, editar e excluir Notícias,
registrar Atualizações de mídia, editar e excluir Mídias e mudar o Nível dos outros. O
`usuario` não pode nada disso. Ninguém ativa, desativa ou muda o Nível de si mesmo, nem de
outro `admin`.

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

Na interface aparece como **Status** ("Status: Em progresso"). O código e o domínio seguem
com Estado de consumo; o status de lançamento da obra (em exibição, finalizado...) aparece
como **Situação**, para não colidir.

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
então um Item de jogo tem Estado de consumo mas não fração completada. Um Item de jogo
aceita o número de horas jogadas, mas **horas não medem Progresso**: nenhuma quantidade
delas leva o Item a Concluído.

O Progresso nunca excede o total da Mídia. Quando o total é conhecido, **Concluído ⇔
Progresso = total** (ADR-0009): atingir o total leva o Item a **Concluído**, baixar dele
devolve o Item a **Em progresso**, e escolher Concluído leva o Progresso ao total. Sem total
conhecido, o Estado de consumo não segue o Progresso.

## Recontagem

Quantas vezes o Usuário reconsumiu uma Mídia depois de concluí-la pela primeira vez —
reassistir um anime, reler um mangá, rejogar um jogo.

Na interface aparece pelo Tipo: "Reassistido N×" (anime), "Relido N×" (mangá) e
"Rejogado N×" (jogo).

**O sistema conta recontagens, não guarda o histórico delas.** Um Item de lista tem um único
par de datas de início e conclusão, sobrescrito a cada nova passagem. Consequência
deliberada: as datas de um Item recontado descrevem a passagem mais recente, não a primeira.

Voltar a **Concluído** um Item que já tinha data de conclusão é uma nova passagem: soma uma
Recontagem e a data de conclusão passa a ser a de hoje, salvo se o Usuário informar outra
(ADR-0009). Sair de Concluído não apaga a data. Voltar a Concluído no mesmo dia da conclusão
anterior não soma Recontagem: é desfazer um toque errado, não uma nova passagem.

---

## Escala das notas

**Avaliação**, **Nota pessoal** e **Nota da fonte** usam a mesma escala: de 0 a 10, com no
máximo uma casa decimal (8,5 vale; 8,55 é recusada, não arredondada). A **Nota média**, que
é calculada, pode ter mais casas, e a interface a mostra com uma.

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

A média das notas das **Avaliações** de uma Mídia. É a nota pública da obra, e na interface
aparece como "Nota dos Usuários".

É calculada das Avaliações, nunca gravada: criar, editar ou apagar uma Avaliação muda a Nota
média na hora. Deriva exclusivamente de Avaliações: uma Mídia que ninguém avaliou não tem
Nota média (nem zero), mesmo que muitos Usuários tenham dado **Nota pessoal** a ela, e mesmo
que ela tenha **Nota da fonte**.

Ordenar por "mais bem avaliadas" usa a Nota média e, quando a Mídia não tem Avaliações, a
**Nota da fonte** no lugar dela. Mídia sem nenhuma das duas vai para o fim. Na tela, cada
nota aparece com o seu rótulo, sem se misturarem.

## Nota da fonte

A nota que a fonte externa dá à Mídia: a do AniList para animes e mangás, a da RAWG para
jogos. Chega pela **Importação**, que é a única que a grava, e cada reimportação a atualiza.
A origem é a fonte de onde a Mídia foi importada.

Não é **Nota média** (não vem de Avaliações do MediaList e não entra na conta delas) nem
**Nota pessoal** (não pertence a nenhum Usuário). Aparece com o nome da fonte ("Nota
AniList", "Nota RAWG"), separada da Nota média. Uma Mídia sem Nota média mostra só a Nota da
fonte; sem nenhuma das duas, não mostra nota alguma.

## Popularidade

Quantos Usuários têm a Mídia na sua **Lista pessoal**, em qualquer Estado de consumo.

Mede alcance, não qualidade — é independente da **Nota média**. Uma Mídia muito adicionada
e mal avaliada é popular.

---

## Notícia

Uma publicação editorial dirigida a todos os Usuários, escrita por quem tem poder de criar
conteúdo. Não pertence a nenhuma Mídia específica.

Qualquer `admin` edita ou exclui qualquer Notícia. Editar não gera Notificação: a Notícia só
passa a mostrar "editada em <data>". Excluir apaga de vez, com as Notificações dela.

## Atualização de mídia

Um aviso vinculado a uma Mídia específica — episódio novo, capítulo novo, mudança de status
da obra. Diferente da **Notícia**, que é geral.

## Notificação

A entrega de uma **Atualização de mídia** ou de uma **Notícia** a um Usuário, com a marca de
lida ou não lida. A Atualização (ou a Notícia) é o fato; a Notificação é o fato chegando a
alguém. A de Notícia vai a todo Usuário ativo, menos o autor.

No app, a Notificação de Notícia também chega como **push**, para quem deixou ligado "Avisar
sobre Notícias" (`avisar_noticias`). O antigo `notificacoes_ativas` das preferências não tem
efeito.
