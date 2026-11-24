// Fluxos da Lista: buscar uma Mídia do seed-dev no Explorar e adicioná-la; mudar Status e Progresso.
import { expect, type Page, test } from '@playwright/test';

import { entrarComContaNova } from './apoio';

/** Anime do seed-dev (Backend/seed_dev.py), 26 episódios. */
const MIDIA = 'Cowboy Bebop';

async function adicionarPeloExplorar(page: Page): Promise<void> {
  await page.goto('/explorar');
  await page.getByRole('searchbox', { name: 'Buscar por título' }).fill('Cowboy');
  await page.getByRole('list', { name: 'Resultados' }).getByRole('link', { name: new RegExp(MIDIA) }).click();

  await expect(page.getByRole('heading', { level: 1, name: MIDIA })).toBeVisible();
  await page.getByRole('button', { name: 'Adicionar à Lista' }).click();
  const editor = page.getByRole('dialog', { name: MIDIA });
  await editor.getByRole('button', { name: 'Salvar' }).click();
  await expect(editor).toBeHidden();
  await expect(page.getByRole('button', { name: 'Editar na Lista' })).toBeVisible();
}

test('buscar no Explorar e adicionar à Lista', async ({ page }) => {
  await entrarComContaNova(page, 'explorar');

  await adicionarPeloExplorar(page);

  await expect(page.getByRole('definition').filter({ hasText: 'Planejado' })).toBeVisible();
  await page.goto('/lista');
  await page.getByRole('tab', { name: /Planejado/ }).click();
  await expect(page.getByRole('tabpanel').getByRole('article', { name: MIDIA })).toBeVisible();
});

test('mudar Status e Progresso na Lista', async ({ page }) => {
  await entrarComContaNova(page, 'lista');
  await adicionarPeloExplorar(page);

  await page.goto('/lista');
  await page.getByRole('tab', { name: /Planejado/ }).click();
  await page.getByRole('button', { name: `Editar ${MIDIA}` }).click();
  const editor = page.getByRole('dialog', { name: MIDIA });
  // O rádio é sr-only: clica-se na pílula visível, o <label> dele.
  await editor.getByText('Em progresso', { exact: true }).click();
  await expect(editor.getByRole('radio', { name: 'Em progresso' })).toBeChecked();
  await editor.getByLabel('Episódios (de 26)').fill('5');
  await editor.getByRole('button', { name: 'Salvar' }).click();
  await expect(editor).toBeHidden();

  await page.getByRole('tab', { name: /Em progresso/ }).click();
  const card = page.getByRole('tabpanel').getByRole('article', { name: MIDIA });
  await expect(card.getByLabel('Progresso: 5 de 26')).toBeVisible();
  await card.getByRole('button', { name: `Mais um em ${MIDIA}` }).click();
  await expect(card.getByLabel('Progresso: 6 de 26')).toBeVisible();

  // Gravado no backend, não só na tela.
  await page.reload();
  await expect(page.getByRole('tab', { name: /Em progresso/ })).toHaveAttribute('aria-selected', 'true');
  await expect(
    page.getByRole('tabpanel').getByRole('article', { name: MIDIA }).getByLabel('Progresso: 6 de 26'),
  ).toBeVisible();
  await expect(page.getByRole('tab', { name: /Planejado/ })).toHaveText(/Planejado\s*0/);
});
