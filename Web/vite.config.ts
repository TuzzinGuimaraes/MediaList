// Dev na 3006, com /api indo para a API em :5000 (o stack docker ou o `make backend-dev`).
// API_ALVO troca o destino do proxy, ex.: API_ALVO=http://localhost:5203 npm run dev.
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

import { gerarTema } from './scripts/tema.ts';

gerarTema();

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // dominio/ compartilhado com o app (dominio/README.md). Os testes dele rodam no jest do Mobile.
  resolve: { alias: { '@dominio': fileURLToPath(new URL('../dominio', import.meta.url)) } },
  server: {
    port: 3006,
    strictPort: true,
    proxy: { '/api': process.env.API_ALVO ?? 'http://localhost:5000' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/testes/preparar.ts'],
    css: false,
    restoreMocks: true,
    // e2e/ é do Playwright (playwright.config.ts).
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
});
