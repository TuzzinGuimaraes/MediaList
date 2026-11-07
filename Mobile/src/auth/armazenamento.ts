import * as SecureStore from 'expo-secure-store';

import type { Tokens } from '../api/cliente';
import type { UsuarioSessao } from '../api/tipos';

export type SessaoGuardada = { tokens: Tokens; usuario: UsuarioSessao };

const CHAVE_ACCESS = 'medialist.access_token';
const CHAVE_REFRESH = 'medialist.refresh_token';
const CHAVE_USUARIO = 'medialist.usuario';

export async function carregarSessao(): Promise<SessaoGuardada | null> {
  const [access, refresh, usuario] = await Promise.all([
    SecureStore.getItemAsync(CHAVE_ACCESS),
    SecureStore.getItemAsync(CHAVE_REFRESH),
    SecureStore.getItemAsync(CHAVE_USUARIO),
  ]);
  if (!access || !usuario) return null;
  try {
    return { tokens: { access, refresh }, usuario: JSON.parse(usuario) };
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
}

export async function apagarSessao(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(CHAVE_ACCESS),
    SecureStore.deleteItemAsync(CHAVE_REFRESH),
    SecureStore.deleteItemAsync(CHAVE_USUARIO),
  ]);
}
