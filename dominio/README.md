# dominio/

Regras do `CONTEXT.md` que a interface precisa, em TypeScript puro, compartilhadas pelo app
(`Mobile/`) e pelo web. Sem build e sem dependências: nada de React, React Native ou pacote do
npm. Os imports internos são relativos (`./datas`), os tipos da API vêm de `contrato/api.d.ts`
por `tipos.ts`, e o backend segue autoritativo (ADR 0002).

## Como cada app importa

Os dois usam o alias `@dominio/*` → `dominio/*` (`import { nomeDoRotulo } from '@dominio/estadoConsumo'`).

- **Mobile:** `paths` no `tsconfig.json` (o Metro e o jest-expo leem dele), `../dominio` no
  `watchFolders` do `metro.config.js` e, no jest do `package.json`, `roots` com a pasta e
  `modulePaths` com `Mobile/node_modules` (os helpers do Babel não existem aqui).
- **Web (Vite):** o mesmo alias em `resolve.alias` do `vite.config.ts` e em `paths` do
  `tsconfig`, com `resolveJsonModule` (o mapa de Rótulos é JSON). O Vite já serve arquivos
  da raiz do repo.

## Testes

Os `*.test.ts` daqui rodam no jest do Mobile (job "Mobile Tests" do CI). Usam só `describe`,
`it`, `it.each` e `expect`, que o Vitest também aceita com `globals`. O mapa de Rótulos de
estado fica em `rotulosDeEstado.json`, e `Backend/tests/test_estado_consumo.py` confere que
ele bate com `schemas/estado_consumo.py`.
