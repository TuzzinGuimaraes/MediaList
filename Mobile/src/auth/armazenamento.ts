import * as SecureStore from 'expo-secure-store';

import type { Tokens } from '../api/cliente';
import type { UsuarioSessao } from '../api/tipos';

/** `trocaDeSenha`: entrou com uma Senha temporária e ainda não a trocou (CONTEXT.md). */
export type SessaoGuardada = { tokens: Tokens; usuario: UsuarioSessao; trocaDeSenha?: boolean };

const CHAVE_ACCESS = 'medialist.access_token';
const CHAVE_REFRESH = 'medialist.refresh_token';
const CHAVE_USUARIO = 'medialist.usuario';
const CHAVE_TROCA = 'medialist.troca_de_senha';

export async function carregarSessao(): Promise<SessaoGuardada | null> {
  const [access, refresh, usuario, troca] = await Promise.all([
    SecureStore.getItemAsync(CHAVE_ACCESS),
    SecureStore.getItemAsync(CHAVE_REFRESH),
    SecureStore.getItemAsync(CHAVE_USUARIO),
    SecureStore.getItemAsync(CHAVE_TROCA),
  ]);
  if (!access || !usuario) return null;
  try {
    return { tokens: { access, refresh }, usuario: JSON.parse(usuario), trocaDeSenha: troca === '1' };
  } catch {
    return null;
  }
}

/**
 * O refresh vai primeiro: se o app morrer entre as gravações, sobra o refresh novo com o
 * access antigo, que só pede outro refresh. O contrário deixaria guardado um refresh já
 * rotacionado, e reusá-lo revoga a família inteira (ADR 0006).
 */
export async function guardarTokens(tokens: Tokens): Promise<void> {
  if (tokens.refresh) await SecureStore.setItemAsync(CHAVE_REFRESH, tokens.refresh);
  else await SecureStore.deleteItemAsync(CHAVE_REFRESH);
  await SecureStore.setItemAsync(CHAVE_ACCESS, tokens.access);
}

export async function guardarSessao(sessao: SessaoGuardada): Promise<void> {
  await guardarTokens(sessao.tokens);
  await SecureStore.setItemAsync(CHAVE_USUARIO, JSON.stringify(sessao.usuario));
  await guardarTrocaDeSenha(sessao.trocaDeSenha ?? false);
}

/** A troca de senha pendente sobrevive ao app fechado: reaberto, ele volta à tela de troca. */
export async function guardarTrocaDeSenha(pendente: boolean): Promise<void> {
  if (pendente) await SecureStore.setItemAsync(CHAVE_TROCA, '1');
  else await SecureStore.deleteItemAsync(CHAVE_TROCA);
}

export async function apagarSessao(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(CHAVE_ACCESS),
    SecureStore.deleteItemAsync(CHAVE_REFRESH),
    SecureStore.deleteItemAsync(CHAVE_USUARIO),
    SecureStore.deleteItemAsync(CHAVE_TROCA),
  ]);
}
