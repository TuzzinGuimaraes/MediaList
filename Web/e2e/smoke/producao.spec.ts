// Smoke da produção (deploy, depois da Vercel): só leitura, nada é gravado. Sem sessão, o
// Início e as rotas profundas caem no login; o que importa é a SPA servir e montar, a API
// responder pelo mesmo domínio e o erro de login chegar à tela (o bug do Content-Length
// travava o corpo de erro só na Vercel). O login falho conta no rate limit do WAF (10/min).
import { expect, type Page, test } from '@playwright/test';

// Curto: na produção tudo responde em ~1 s; travar é o defeito que o smoke procura.
test.use({ actionTimeout: 10_000, navigationTimeout: 15_000 });
test.describe.configure({ timeout: 30_000 });

const EMAIL_INEXISTENTE = 'smoke-inexistente@exemplo.invalid';

async function esperarTelaDeAcesso(page: Page) {
  await expect(page.getByText('MediaList', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
}

test('Início abre e mostra a marca', async ({ page }) => {
  const resposta = await page.goto('/');
  expect(resposta?.status()).toBe(200);
  await esperarTelaDeAcesso(page);
});

test('rota profunda abre direto', async ({ page }) => {
  const resposta = await page.goto('/explorar');
  expect(resposta?.status()).toBe(200);
  await esperarTelaDeAcesso(page);
  await expect(page).toHaveURL(/\/entrar\?redirecionar=.*explorar/);
});

test('login com email inexistente mostra o erro na tela', async ({ page }) => {
  await page.goto('/entrar');
  await page.getByLabel('Email').fill(EMAIL_INEXISTENTE);
  await page.getByLabel('Senha', { exact: true }).fill('senha-errada-smoke');
  const login = page.waitForResponse((r) => r.url().endsWith('/api/auth/login'));
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();

  expect((await login).status()).toBe(401);
  await expect(page.getByRole('alert')).toHaveText('Email ou senha incorretos');
  await expect(page).toHaveURL(/\/entrar/);
});

test('GET /api/ping responde 200', async ({ request }) => {
  const resposta = await request.get('/api/ping');
  expect(resposta.status()).toBe(200);
  expect(await resposta.json()).toEqual({ status: 'ok' });
});
