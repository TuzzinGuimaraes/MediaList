// O que a sessão do web guarda no navegador (ADR 0006).
//
// Nenhum token fica no localStorage. O access vive só em memória (sessao.ts) e o refresh
// num cookie httpOnly que o backend grava em `/api/auth` (o script não o lê). Aqui fica só
// a marca `medialist.conectado`, sem segredo: diz ao abrir se vale tentar o refresh e, ao
// sumir, avisa as outras abas de que a sessão saiu.

export const CHAVE_CONECTADO = 'medialist.conectado';

/**
 * Chaves antigas: o token e o Usuário do web em CRA, e o refresh que o web novo guardava
 * aqui antes do cookie (`medialist.refresh`).
 */
const CHAVES_ANTIGAS = ['token', 'user', 'permissions', 'medialist.refresh'];

export function estaConectado(): boolean {
  try {
    return localStorage.getItem(CHAVE_CONECTADO) === '1';
  } catch {
    return false;
  }
}

export function marcarConectado(conectado: boolean): void {
  try {
    if (conectado) localStorage.setItem(CHAVE_CONECTADO, '1');
    else localStorage.removeItem(CHAVE_CONECTADO);
  } catch {
    // Armazenamento bloqueado (modo privado restrito): a sessão vale só nesta aba.
  }
}

/** Some com os tokens que versões anteriores deixavam no localStorage. */
export function descartarSessaoAntiga(): void {
  try {
    for (const chave of CHAVES_ANTIGAS) localStorage.removeItem(chave);
  } catch {
    // Sem armazenamento, nada a descartar.
  }
}
