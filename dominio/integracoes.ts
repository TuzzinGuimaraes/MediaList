// Integrações (CONTEXT.md, ADR 0015): os textos que o web e o app mostram na seção
// Integrações do Perfil. As regras de importar ficam no backend (`Backend/integracoes`).
import type { TipoMidia } from './estadoConsumo';
import type { Integracao, NaoEncontrado, ResultadoImportacao } from './tipos';

export type NomePlataforma = Integracao['plataforma'];

/** O que o campo de conectar pede em cada plataforma (Q112: nome de usuário ou URL do perfil). */
export const PEDIDO_DE_CONTA: Record<NomePlataforma, { rotulo: string; exemplo: string }> = {
  anilist: { rotulo: 'Nome de usuário do AniList', exemplo: 'ex.: Fulano ou anilist.co/user/Fulano' },
  mal: { rotulo: 'Nome de usuário do MyAnimeList', exemplo: 'ex.: Fulano' },
  steam: { rotulo: 'URL do perfil da Steam', exemplo: 'ex.: steamcommunity.com/id/fulano' },
};

/** Nome da plataforma onde a API não manda o `rotulo` (a lista de vínculos do admin). */
export const ROTULO_DA_PLATAFORMA: Record<NomePlataforma, string> = { anilist: 'AniList', mal: 'MyAnimeList', steam: 'Steam' };

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

/** Plataformas sem prévia: sincronizam direto, todo dia e por "Sincronizar agora" (Steam, Q113). */
export const SINCRONIZA_SEM_PREVIA: ReadonlySet<NomePlataforma> = new Set<NomePlataforma>(['steam']);

/** "12 jogos ainda em processamento" (null sem pendentes): o resto casa na sincronização diária. */
export function textoDePendentes(pendentes: number): string | null {
  if (pendentes <= 0) return null;
  return `${contagem(pendentes, 'jogo', 'jogos')} ainda em processamento`;
}

/** Não encontrado que dá para vincular a uma Mídia: os resultados antigos não trazem `origem_id` nem Tipo. */
export function vinculavel(n: NaoEncontrado): n is NaoEncontrado & { origem_id: string; tipo: TipoMidia } {
  return Boolean(n.origem_id && n.tipo);
}

/** Identifica o Não encontrado na plataforma (no MAL, o anime 1 e o mangá 1 são obras diferentes). */
export function chaveDoNaoEncontrado(n: Pick<NaoEncontrado, 'origem_id' | 'tipo'>): string {
  return `${n.tipo ?? ''}:${n.origem_id ?? ''}`;
}

/** Título do Vincular: a busca do Catálogo fica no Tipo do item. */
export function tituloDoVincular(n: Pick<NaoEncontrado, 'titulo'>): string {
  return `Vincular “${n.titulo}”`;
}
