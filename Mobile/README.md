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

O script encaminha as portas 8081 (Metro) e 5000 (API) do Windows para o IP atual do WSL e
libera as duas no firewall. Depois, na raiz do repo:

```bash
make mobile-dev
```

O alvo (`scripts/dev.sh`) descobre o IP do Windows na rede via `powershell.exe`, avisa se o
portproxy não aponta para o IP atual do WSL e sobe o Expo com
`REACT_NATIVE_PACKAGER_HOSTNAME=<ip-do-windows>`, `--lan` e `--port 8081` fixo. Se a 8081 já
estiver ocupada no WSL, ele para com erro: o portproxy só encaminha essa porta. Fora do WSL,
roda um `npx expo start` simples.

- `make mobile-dev MOBILE_ARGS=--dry-run` faz as verificações e só mostra o comando.
- Outros argumentos vão para o `expo start`: `make mobile-dev MOBILE_ARGS=--clear`.

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

## Testes de tela

Os testes em `src/testes/` simulam só o `fetch` (`fetchSimulado.ts`). O login fica em
`src/testes/sessao.tsx`: `abrirLogado(url)` guarda a sessão e abre a tela direto;
`entrarPeloLogin()` passa pela tela de login (precisa da rota `POST /auth/login` com `loginOk`).

## Verificação

```bash
npm run typecheck
npm run lint
npm test
```
