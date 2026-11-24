// E2E do web (ticket 17 da revisão, spec e2e-web). Dois projetos na mesma suíte:
// - fluxos: os fluxos críticos contra um stack com `seed-dev` (o compose; ninguém sobe servidor aqui);
// - smoke: só leitura, contra a produção no deploy (e2e/smoke).
// E2E_BASE_URL escolhe o alvo; o default é o web do compose (FRONTEND_PORT padrão).
import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 1 : undefined,
  // Para antes do timeout do job, para o relatório sair.
  globalTimeout: CI ? 10 * 60_000 : undefined,
  reporter: CI ? [['github'], ['list'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3005',
    locale: 'pt-BR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'fluxos', testDir: './e2e/fluxos' },
    { name: 'smoke', testDir: './e2e/smoke' },
  ],
});
