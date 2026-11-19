/** Formato `Pagina[T]` do contrato: `GET /midias`, Avaliações de uma Mídia, Notícias e Usuários da moderação. */
export type Pagina<T> = { itens: T[]; pagina: number; por_pagina: number; total: number };

export type Paginacao = {
  pagina: number;
  totalDePaginas: number;
  temAnterior: boolean;
  temProxima: boolean;
  /** Posição do primeiro e do último item desta página (1-based), para "31–60 de 245"; null sem itens. */
  faixa: { de: number; ate: number } | null;
};

/** O que a tela precisa para navegar entre páginas, a partir do `total` da resposta. */
export function paginacao(p: Pagina<unknown>): Paginacao {
  const totalDePaginas = p.total === 0 ? 0 : Math.ceil(p.total / p.por_pagina);
  const de = (p.pagina - 1) * p.por_pagina + 1;
  return {
    pagina: p.pagina,
    totalDePaginas,
    temAnterior: p.pagina > 1,
    temProxima: p.pagina < totalDePaginas,
    faixa: p.itens.length ? { de, ate: de + p.itens.length - 1 } : null,
  };
}
