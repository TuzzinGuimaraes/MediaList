// Fluxos da Lista: buscar uma Mídia do seed-dev no Explorar e adicioná-la; mudar o Status pelo
// menu ⋯ da Lista e o Progresso no detalhe da Mídia.
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

/** O botão do Status na coluna lateral da Lista (nav "Status"). */
function statusDaColuna(page: Page, nome: string) {
  return page.getByRole('navigation', { name: 'Status' }).getByRole('button', { name: new RegExp(`^${nome}`) });
}

/** O card da Mídia na grade do Status (o link tem título, nota e Progresso no nome). */
function cardNoStatus(page: Page, status: string) {
  return page.getByRole('list', { name: status }).getByRole('listitem').filter({ has: page.getByRole('link', { name: new RegExp(`^${MIDIA}`) }) });
}

test('buscar no Explorar e adicionar à Lista', async ({ page }) => {
  await entrarComContaNova(page, 'explorar');

  await adicionarPeloExplorar(page);

  await expect(page.getByRole('definition').filter({ hasText: 'Planejado' })).toBeVisible();
  await page.goto('/lista');
  await statusDaColuna(page, 'Planejado').click();
  await expect(statusDaColuna(page, 'Planejado')).toHaveAttribute('aria-current', 'true');
  await expect(cardNoStatus(page, 'Planejado')).toBeVisible();
});

test('mudar o Status pelo menu da Lista e o Progresso no detalhe', async ({ page }) => {
  await entrarComContaNova(page, 'lista');
  await adicionarPeloExplorar(page);

  await page.goto('/lista');
  await statusDaColuna(page, 'Planejado').click();
  await cardNoStatus(page, 'Planejado').getByRole('button', { name: `Status de ${MIDIA}: Planejado. Mudar` }).click();
  await page.getByRole('menu', { name: `Status de ${MIDIA}` }).getByRole('menuitemradio', { name: 'Em progresso' }).click();
  await expect(statusDaColuna(page, 'Planejado')).toHaveText(/Planejado\s*0/);

  await statusDaColuna(page, 'Em progresso').click();
  const card = cardNoStatus(page, 'Em progresso');
  await expect(card.getByRole('button', { name: `Status de ${MIDIA}: Em progresso. Mudar` })).toBeVisible();

  // O Progresso se edita no detalhe da Mídia (a Lista não tem stepper).
  await card.getByRole('link', { name: new RegExp(`^${MIDIA}`) }).click();
  await expect(page.getByRole('heading', { level: 1, name: MIDIA })).toBeVisible();
  await page.getByRole('button', { name: 'Editar na Lista' }).click();
  const editor = page.getByRole('dialog', { name: MIDIA });
  await expect(editor.getByRole('radio', { name: 'Em progresso' })).toBeChecked();
  await editor.getByLabel('Episódios (de 26)').fill('5');
  await editor.getByRole('button', { name: 'Salvar' }).click();
  await expect(editor).toBeHidden();
  await expect(page.getByRole('definition').filter({ hasText: '5 de 26' })).toBeVisible();

  // Gravado no backend, não só na tela.
  await page.goto('/lista');
  await statusDaColuna(page, 'Em progresso').click();
  await expect(cardNoStatus(page, 'Em progresso').getByRole('link', { name: `${MIDIA}, 5/26 ep` })).toBeVisible();
  await expect(statusDaColuna(page, 'Planejado')).toHaveText(/Planejado\s*0/);
});
