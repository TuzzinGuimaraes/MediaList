# App mobile com Expo, na mesma base de código

O MediaList ganha um app nativo (Android e iOS) para o lado do Usuário comum: entrar,
explorar o Catálogo, ver o detalhe de uma Mídia, manter a Lista pessoal, escrever
Avaliações, ler Notícias e Notificações e ver o perfil. Admin e moderação ficam só no web.
O app vive em `Mobile/`, ao lado de `Backend/` e `Frontend/`, e conversa com a mesma API.

A stack é **Expo SDK 58** (React Native 0.88) com TypeScript, **Expo Router** e
**TanStack Query**, rodando no **Expo Go** durante o desenvolvimento. Só entram
bibliotecas que funcionam no Expo Go; sem development build, sem EAS e sem publicação nas
lojas na v1. Isso deixa de fora notificações push, que ficam para depois.

- **Rotas** em `app/`: grupo `(auth)` (login, registro), grupo `(tabs)` com as cinco abas
  (Início, Explorar, Lista, Notícias, Perfil). As telas são finas e compõem hooks e
  componentes. O guarda de sessão é um `Redirect` no layout de cada grupo; o
  `Stack.Protected` redireciona para `/(auth)`, que não é rota quando o grupo não tem
  `index`.
- **API** em `src/api/`: um cliente HTTP único, tipos gerados do OpenAPI do Backend
  (`contrato/api.d.ts`, ADR 0011) e hooks do Query por recurso. Cache só em memória; as
  consultas se refazem quando o app volta ao primeiro plano. *(Atualizado pelo ADR 0011:
  antes eram tipos escritos à mão só para os endpoints usados, sem OpenAPI.)*
- **Sessão autenticada** em `src/auth/`: um Context com o Usuário e os tokens guardados no
  `expo-secure-store`. Um 401 dispara **um único** refresh compartilhado entre as
  requisições simultâneas (ADR 0006: dois refreshes com o mesmo token contam como reuso e
  derrubam a família), e cada requisição é repetida uma vez com o token novo. Refresh
  recusado (401/403) limpa a sessão e volta ao login; falta de rede ou 5xx no refresh não
  desloga, vira o estado "tentar de novo". Login com `refresh_token: null` funciona até o
  access token expirar.
- **Domínio** em `src/dominio/`: cópia em TS das regras do `CONTEXT.md` que a interface
  precisa. O mapa de Rótulos de estado passa a existir em três lugares (backend, web,
  app); aceito porque o mapa é estável e o backend valida (ADR 0002). O **Recorte de
  catálogo** é estado de interface em memória. Sem Redux nem Zustand; formulários com
  estado simples e validação em funções puras.
- **URL da API**: em desenvolvimento, o host do Metro (o IP da máquina na rede local) na
  porta 5000 com `/api`; `EXPO_PUBLIC_API_URL` sobrescreve e é obrigatória em build de
  produção.
- **Interface** toda em português, com strings agrupadas por tela, sem framework de i18n.
  Temas Escuro (padrão) e Claro, com a opção Sistema no Perfil; as cores vêm de
  `design/tokens.js` na raiz (ticket 29 da revisão), a fonte única do Tailwind e das cores
  usadas em JS. *(Atualizado: antes era só o tema escuro, com a paleta do web copiada para
  `src/tema/paleta.js`.)*
- **Testes**: uma fronteira só, o `fetch` global. Os testes de tela renderizam o app
  inteiro (`renderRouter` do Expo Router, `jest-expo`, React Native Testing Library) com o
  `expo-secure-store` em memória. Sem E2E na v1. O CI roda typecheck, `expo lint` e testes
  no job "Mobile Tests". Ferramentas: npm, `tsc --noEmit`, `expo lint`, sem Prettier.

## Estilo: NativeWind fora do suporte oficial

O estilo usa **NativeWind 4.2.7** com `tailwindcss` 3.4.19, as duas versões **fixadas**
(sem `^`/`~`) no `package.json`. É uma escolha consciente fora do suporte: a página de
instalação do NativeWind 4.2.7 declara compatibilidade só até o SDK 57
([nativewind.dev](https://www.nativewind.dev/docs/getting-started/installation)), há um
aviso conhecido com `ImageBackground` no SDK 58
([nativewind#1881](https://github.com/nativewind/nativewind/issues/1881)) e a v5, que
seria a linha nova, quebra no SDK 58
([react-native-css#506](https://github.com/nativewind/react-native-css/issues/506)). Na
prática a 4.2.7 instala sem conflito de dependências, o `expo export --platform android`
completa e os testes passam; o único ajuste é `declare module '*.css'` em
`nativewind-env.d.ts` para o `tsc` aceitar o import do CSS global.

A alternativa era começar direto com `StyleSheet`. Rejeitada por ora porque as classes do
Tailwind mantêm o app visualmente alinhado ao web com pouco código. **Plano B**, se o
NativeWind quebrar num patch do SDK 58 ou travar a atualização para o SDK 59: migrar as
telas para `StyleSheet`, com as cores já em tokens tipados (`design/tokens.js` +
`tokens.d.ts`). A versão fixada impede que uma atualização automática traga a quebra sem
que alguém decida.

**Plano (2026-11, ticket 20 da revisão):** o app fica na 4.2.7 até a **v5 ficar estável com
o SDK do momento**; em 2026-11 a v5 está em RC, testada no SDK 57. A migração para a v5 (que
usa Tailwind 4) é preferida ao Plano B. Para ela custar pouco, os tokens já ficam num formato
fácil de converter para o `@theme` do Tailwind 4: cores com nomes semânticos, um mapa por
tema, sem lógica (`design/tokens.js`). As cores trocam de tema por variáveis CSS com `vars()`
do NativeWind, o mesmo mecanismo que o `@theme` usa.
