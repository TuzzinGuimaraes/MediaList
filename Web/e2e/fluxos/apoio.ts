// Apoio dos fluxos: cada teste cria o próprio Usuário (email único), pela tela ou pela API.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { type APIRequestContext, expect, type Page } from '@playwright/test';

export type Conta = { nome: string; email: string; senha: string };

const RAIZ_DO_REPO = fileURLToPath(new URL('../../..', import.meta.url));

export function novaConta(prefixo: string): Conta {
  const sufixo = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return { nome: `E2E ${prefixo}`, email: `e2e-${prefixo}-${sufixo}@exemplo.com`, senha: 'senha-e2e-123' };
}

/** Cadastro pela API (quando o cadastro não é o que o teste exercita). */
export async function cadastrarPelaApi(request: APIRequestContext, conta: Conta): Promise<void> {
  const resposta = await request.post('/api/auth/registro', {
    data: { nome_completo: conta.nome, email: conta.email, senha: conta.senha },
  });
  expect(resposta.status(), await resposta.text()).toBe(201);
}

export async function entrar(page: Page, email: string, senha: string): Promise<void> {
  await page.goto('/entrar');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(senha);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

/** Logado: o botão da conta aparece na nav. */
export async function esperarLogado(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: 'Conta' })).toBeVisible();
}

export async function sair(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Conta' }).click();
  await page.getByRole('menuitem', { name: 'Sair' }).click();
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
}

/** Usuário novo, cadastrado pela API e logado pela tela. */
export async function entrarComContaNova(page: Page, prefixo: string): Promise<Conta> {
  const conta = novaConta(prefixo);
  await cadastrarPelaApi(page.request, conta);
  await entrar(page, conta.email, conta.senha);
  await esperarLogado(page);
  return conta;
}

/**
 * Gera uma Senha temporária como o admin (`redefinir_senha.py`), no container do backend do
 * stack alvo. A senha é a última linha do stdout. E2E_COMPOSE_PROJECT escolhe o projeto do
 * compose; E2E_REDEFINIR_SENHA troca o comando inteiro (o email vai como último argumento).
 */
export function gerarSenhaTemporaria(email: string): string {
  const comando = process.env.E2E_REDEFINIR_SENHA;
  const projeto = process.env.E2E_COMPOSE_PROJECT;
  const saida = comando
    ? execFileSync('sh', ['-c', `${comando} "$1"`, 'sh', email], { cwd: RAIZ_DO_REPO, encoding: 'utf8' })
    : execFileSync(
        'docker',
        ['compose', ...(projeto ? ['-p', projeto] : []), 'exec', '-T', 'backend', 'python', 'redefinir_senha.py', email],
        { cwd: RAIZ_DO_REPO, encoding: 'utf8' },
      );
  const senha = saida.trim().split('\n').at(-1)?.trim();
  if (!senha) throw new Error(`redefinir_senha.py não devolveu senha para ${email}`);
  return senha;
}
