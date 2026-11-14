# MediaList Mobile

App Expo (SDK 58) do MediaList para Android e iOS. Decisões em `docs/adr/0005-app-mobile-expo.md`.

## Rodar no celular (Expo Go)

1. Suba a API: `docker compose up -d` na raiz (backend em `http://localhost:5000/api`).
2. Instale e inicie:

   ```bash
   cd Mobile
   npm install
   npx expo start
   ```

3. Abra o Expo Go (SDK 58) e leia o QR code. Celular e computador na mesma rede.

### No WSL2 (modo NAT)

O celular não alcança o WSL direto. A cada reinício do WSL, rode no Windows, num PowerShell
como administrador:

```powershell
powershell -ExecutionPolicy Bypass -File C:\Users\user\expo-portproxy.ps1
```

O script encaminha as portas 8081 (Metro) e 5000 (API) do Windows para o IP atual do WSL,
libera as duas no firewall e mostra o comando para iniciar o Expo com o IP do Windows na rede:

```bash
REACT_NATIVE_PACKAGER_HOSTNAME=<ip-do-windows> npx expo start --lan
```

## URL da API

Sem configuração, o app usa o host do Metro (o IP do computador que o Expo Go já
alcança) na porta 5000: `http://<ip-do-metro>:5000/api`. Se o firewall bloquear a porta
5000, libere-a para a rede local.

Para apontar para outro servidor, defina `EXPO_PUBLIC_API_URL` (obrigatória em build de
produção):

```bash
EXPO_PUBLIC_API_URL=https://api.exemplo.com/api npx expo start
```

## Tipografia

Escala única em `src/tema/tipografia.js`, exposta como classes do Tailwind (tamanho/altura de linha):
`text-titulo-tela` 28/36, `text-titulo-secao` 20/28, `text-corpo` 16/24, `text-legenda` 14/20 e
`text-campo` 16 (só em `TextInput`, sem altura de linha). Todo `Text` usa um desses níveis; nada de
`text-xs`/`text-sm`/`fontSize` solto. O ajuste de fonte do sistema vale em todo o app (nunca
`allowFontScaling={false}`); só pílulas, selos e o stepper limitam o crescimento com
`maxFontSizeMultiplier={1.3}`.

## PROTÓTIPO da identidade visual (ticket 29, branch descartável)

Esta branch (`artur/identidade-prototipo`) não vai para a master. `npm start` e abra no Expo Go: a
barra amarela flutuante (só em `__DEV__`) troca os eixos em memória. Linha de cima `‹ eixo ›`, linha
de baixo `‹ valor ›`; arraste pela alça ≡ e recolha no ×.

2ª rodada. Fixos: Carmesim no tema escuro e Rubi no claro, fonte Outfit, animação micro (o detalhe
abre com fade), haptics leve só ao salvar ou remover um Item, Início A com destaques paginados
(até 5 de Em alta, troca a cada 6 s, pausa ao tocar), detalhe único (banner + pôster sobreposto,
botão grande de Lista, título alternativo) e o monograma "M". Eixos que sobraram:

- `tema`: escuro, claro, sistema (também no Perfil).
- `card`: por contexto (padrão; C no Continuar, A em Em alta e Top 10), C compacto (~70% da tela em
  todos os carrosséis), C (controle). Os destaques seguem o espírito do C em todos.
- `assinatura`: nenhuma, cor ambiente, fio de progresso (padrão), corte diagonal, todas
  (`src/prototipo/PrototipoAssinatura.tsx`). A cor ambiente busca `coverImage.color` direto no
  AniList (só no protótipo; o banco não guarda a cor) e, sem id do AniList, deriva a cor do título.

- Cores: tokens semânticos em `src/tema/paletas.js`, classes `rgb(var(--cor-x) / <alpha-value>)` no
  `tailwind.config.js` e valores aplicados com `vars()` num View raiz (`src/prototipo/PrototipoContext.tsx`).
  Os nomes antigos (`dark-*`, `accent-*`, `text-*`) apontam para os tokens. Em JS: `usePaleta()`.
- Fonte: `text-<nivel>` e `font-semibold`/`font-bold` põem `fontFamily: var(--fonte-<peso>)`, porque
  no Android uma família customizada não ganha negrito por `fontWeight`.
- Jest: o Reanimated real não roda no Jest; `react-native-reanimated/mock` é redirecionado para
  `src/testes/reanimadoSimulado.js`. Os testes abrem nos valores padrão, sem a barra, sem troca
  automática dos destaques e sem chamar o AniList.

## Verificação

```bash
npm run typecheck
npm run lint
npm test
```
