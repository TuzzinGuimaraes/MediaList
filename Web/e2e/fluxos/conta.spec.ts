// Fluxos da conta: cadastro e login, Senha temporária até a troca, erro de login na tela.
import { expect, test } from '@playwright/test';

import { cadastrarPelaApi, entrar, esperarLogado, gerarSenhaTemporaria, novaConta, sair } from './apoio';

test('cadastro entra na conta, e depois o login também', async ({ page }) => {
  const conta = novaConta('cadastro');

  await page.goto('/registro');
  await page.getByLabel('Nome').fill(conta.nome);
  await page.getByLabel('Email').fill(conta.email);
  await page.getByLabel('Senha', { exact: true }).fill(conta.senha);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await esperarLogado(page);
  await expect(page).toHaveURL('/');

  await sair(page);
  await entrar(page, conta.email, conta.senha);
  await esperarLogado(page);
  await page.getByRole('button', { name: 'Conta' }).click();
  await expect(page.getByRole('menu', { name: 'Conta' })).toContainText(conta.email);
});

test('login com senha errada mostra o erro', async ({ page }) => {
  const conta = novaConta('senha-errada');
  await cadastrarPelaApi(page.request, conta);

  await entrar(page, conta.email, 'nao-e-a-senha');

  await expect(page.getByRole('alert')).toHaveText('Email ou senha incorretos');
  await expect(page).toHaveURL(/\/entrar/);
  await expect(page.getByRole('button', { name: 'Conta' })).toHaveCount(0);
});

test('Senha temporária leva a "Defina sua nova senha" e, trocada, a conta volta ao normal', async ({ page }) => {
  const conta = novaConta('temporaria');
  await cadastrarPelaApi(page.request, conta);
  const temporaria = gerarSenhaTemporaria(conta.email);
  const nova = 'senha-nova-e2e-456';

  await entrar(page, conta.email, temporaria);
  await expect(page.getByRole('heading', { name: 'Defina sua nova senha' })).toBeVisible();
  await page.getByLabel('Senha temporária', { exact: true }).fill(temporaria);
  await page.getByLabel('Nova senha', { exact: true }).fill(nova);
  await page.getByLabel('Confirme a nova senha', { exact: true }).fill(nova);
  await page.getByRole('button', { name: 'Salvar nova senha' }).click();

  await esperarLogado(page);
  await expect(page.getByRole('heading', { name: 'Defina sua nova senha' })).toHaveCount(0);

  await sair(page);
  await entrar(page, conta.email, nova);
  await esperarLogado(page);
  await page.goto('/lista');
  await expect(page.getByRole('heading', { name: 'Minha Lista' })).toBeVisible();
});
