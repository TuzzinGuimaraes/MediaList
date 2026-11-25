# Integrações por perfil público, sem OAuth

O Usuário traz o que já consumiu no **AniList**, no **MyAnimeList** (pela API ou pelo arquivo XML exportado) e na **Steam** informando só o nome de usuário ou a URL do perfil público. O MediaList não usa OAuth nem guarda token ou senha de terceiros: lê apenas o que o perfil já mostra publicamente. Não há verificação de posse: conectar o perfil de outra pessoa só traz os itens dela para a própria Lista. O Vincular de um Não encontrado é diferente: ele grava um vínculo global, que vale para todos os Usuários.

Anime e mangá são importados sob demanda (o Usuário clica em "Importar", vê uma prévia e confirma). A Steam sincroniza todo dia no GitHub Actions e também por "Sincronizar agora". Obras fora do Catálogo entram pela mesma rotina da Importação, sempre com o AniList como fonte de anime e mangá (o MAL é casado pelo `idMal` do AniList) e o RAWG como fonte de jogos (o jogo da Steam casa se as lojas do RAWG tiverem a mesma `appid`; se o RAWG não tem o jogo, a Mídia é criada pela loja da Steam, e o que a loja diz que não é jogo é ignorado). O fallback da loja da Steam (`appdetails`, público) só aceita dado validado: capa apenas por `https://` dos hosts de imagem da Steam, nome e empresas como texto com teto, e a `appid` sempre a pedida; a capa vertical (`library_600x900`) só entra se um HEAD rápido no CDN a confirmar dentro do orçamento da sincronização, senão fica a `header_image`. O que não casa com segurança fica numa lista de "Não encontrados", sem palpite; dali o próprio Usuário vincula o item a uma Mídia do mesmo Tipo, e o vínculo vale na hora para todos (sem fila), com autor e data registrados para o admin desfazer (desfazer não apaga Itens já gravados). O vínculo é reserva: a fonte casa primeiro (o Catálogo, o AniList, o casamento já gravado da Steam, o RAWG e a loja) e o vínculo só vale para o item que ela não casa, então um vínculo errado não tira o que a fonte acerta. Pela mesma razão, o Vincular da Steam não troca um casamento que a fonte já fez: responde conflito e o jogo entra pela próxima sincronização.

A importação nunca apaga trabalho do Usuário: o Progresso fica com o maior valor, o Status só muda se o Progresso subiu, a nota da origem só entra onde não há nota, e notas pessoais e Avaliações nunca são tocadas. Zerado e platinado nunca são automáticos.

## Considered Options

- **OAuth em cada plataforma:** daria acesso a listas privadas, ao custo de guardar e renovar tokens de terceiros.
- **PSN e Xbox:** não têm API pública oficial; as alternativas (bibliotecas não oficiais com o token de sessão do Usuário, serviços como o OpenXBL) têm risco de bloqueio e termos de uso duvidosos.
- **Biblioteca Steam inteira:** lotaria a Lista com jogos nunca abertos; só entram jogos com horas.
- **Fonte de catálogo para o MAL:** manteria duas fontes de anime e mangá; o `idMal` do AniList evita isso.

## Consequences

- Perfis privados não funcionam; a tela explica como torná-los públicos.
- Mudanças feitas na origem depois da importação só chegam numa nova importação (anime e mangá) ou na sincronização diária (Steam).
- Depende de duas chaves grátis: `STEAM_API_KEY` e `MAL_CLIENT_ID`.
- Como o vínculo é global e sem fila, um Usuário pode vincular errado para todos; o risco fica limitado porque ele só vincula o que apareceu como Não encontrado para ele, a fonte sempre vence o vínculo e o admin vê o autor e desfaz.
