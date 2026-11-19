// Onde a sessão do web fica guardada (ADR 0006, ticket 03 da spec web-novo).
//
// O access token fica só em memória (SessaoContext). O refresh precisa sobreviver ao
// recarregar e às outras abas, e o backend hoje só o aceita no corpo do POST /auth/refresh
// (não há cookie httpOnly): ele fica no localStorage. É legível por um script injetado
// (XSS), o mesmo risco do token que o web antigo guardava lá, mas com limites: o refresh
// é rotativo e o reuso derruba a família inteira; o access dura pouco em memória; e o
// logout revoga os dois. O ideal (cookie httpOnly + SameSite emitido pelo backend) fica
// como pendência na Resolution do ticket.

export const CHAVE_REFRESH = 'medialist.refresh';

/** Chaves do web antigo (em CRA, já removido): o token e o Usuário no localStorage. */
const CHAVES_ANTIGAS = ['token', 'user', 'permissions'];

export function lerRefresh(): string | null {
  try {
    return localStorage.getItem(CHAVE_REFRESH);
  } catch {
    return null;
  }
}

export function guardarRefresh(token: string | null): void {
  try {
    if (token) localStorage.setItem(CHAVE_REFRESH, token);
    else localStorage.removeItem(CHAVE_REFRESH);
  } catch {
    // Armazenamento bloqueado (modo privado restrito): a sessão vale só nesta aba.
  }
}

/** Some com o token que o web antigo deixava no localStorage. */
export function descartarSessaoAntiga(): void {
  try {
    for (const chave of CHAVES_ANTIGAS) localStorage.removeItem(chave);
  } catch {
    // Sem armazenamento, nada a descartar.
  }
}
