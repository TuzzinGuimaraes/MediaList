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

export async function guardarTokens(tokens: Tokens): Promise<void> {
  await SecureStore.setItemAsync(CHAVE_ACCESS, tokens.access);
  if (tokens.refresh) await SecureStore.setItemAsync(CHAVE_REFRESH, tokens.refresh);
  else await SecureStore.deleteItemAsync(CHAVE_REFRESH);
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
