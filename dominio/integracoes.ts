// Integrações (CONTEXT.md, ADR 0015): os textos que o web e o app mostram na seção
// Integrações do Perfil. As regras de importar ficam no backend (`Backend/integracoes`).
import type { Integracao, ResultadoImportacao } from './tipos';

export type NomePlataforma = Integracao['plataforma'];

/** O que o campo de conectar pede em cada plataforma (Q112: nome de usuário ou URL do perfil). */
export const PEDIDO_DE_CONTA: Record<NomePlataforma, { rotulo: string; exemplo: string }> = {
  anilist: { rotulo: 'Nome de usuário do AniList', exemplo: 'ex.: Fulano ou anilist.co/user/Fulano' },
  mal: { rotulo: 'Nome de usuário do MyAnimeList', exemplo: 'ex.: Fulano' },
  steam: { rotulo: 'URL do perfil da Steam', exemplo: 'ex.: steamcommunity.com/id/fulano' },
};

function contagem(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** "32 novos · 5 atualizados · 3 não encontrados" (as partes zeradas saem; tudo zero: "Nada novo"). */
export function resumoDaImportacao(r: Pick<ResultadoImportacao, 'novos' | 'atualizados' | 'total_nao_encontrados'>): string {
  const partes = [
    r.novos ? contagem(r.novos, 'novo', 'novos') : null,
    r.atualizados ? contagem(r.atualizados, 'atualizado', 'atualizados') : null,
    r.total_nao_encontrados ? contagem(r.total_nao_encontrados, 'não encontrado', 'não encontrados') : null,
  ].filter(Boolean);
  return partes.length ? partes.join(' · ') : 'Nada novo';
}

/** A prévia não grava nada: sem novos nem atualizados, não há o que confirmar. */
export function temOQueConfirmar(r: Pick<ResultadoImportacao, 'novos' | 'atualizados'>): boolean {
  return r.novos + r.atualizados > 0;
}

/** Quantos Não encontrados ficaram fora da amostra que a API manda. */
export function naoEncontradosForaDaAmostra(r: Pick<ResultadoImportacao, 'nao_encontrados' | 'total_nao_encontrados'>): number {
  return Math.max(r.total_nao_encontrados - r.nao_encontrados.length, 0);
}
