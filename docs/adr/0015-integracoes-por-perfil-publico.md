# Integrações por perfil público, sem OAuth

O Usuário traz o que já consumiu no **AniList**, no **MyAnimeList** (pela API ou pelo arquivo XML exportado) e na **Steam** informando só o nome de usuário ou a URL do perfil público. O MediaList não usa OAuth nem guarda token ou senha de terceiros: lê apenas o que o perfil já mostra publicamente. Não há verificação de posse; vincular o perfil de outra pessoa só afeta a própria Lista.

Anime e mangá são importados sob demanda (o Usuário clica em "Importar", vê uma prévia e confirma). A Steam sincroniza todo dia no GitHub Actions e também por "Sincronizar agora". Obras fora do Catálogo entram pela mesma rotina da Importação, sempre com o AniList como fonte de anime e mangá (o MAL é casado pelo `idMal` do AniList) e o RAWG como fonte de jogos (o jogo da Steam só casa se as lojas do RAWG tiverem a mesma `appid`). O que não casa com segurança fica numa lista de "Não encontrados", sem palpite.

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
