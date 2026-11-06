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

## URL da API

Sem configuração, o app usa o host do Metro (o IP do computador que o Expo Go já
alcança) na porta 5000: `http://<ip-do-metro>:5000/api`. Se o firewall bloquear a porta
5000, libere-a para a rede local.

Para apontar para outro servidor, defina `EXPO_PUBLIC_API_URL` (obrigatória em build de
produção):

```bash
EXPO_PUBLIC_API_URL=https://api.exemplo.com/api npx expo start
```

## Verificação

```bash
npm run typecheck
npm run lint
npm test
```
