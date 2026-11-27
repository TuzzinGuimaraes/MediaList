// Relações entre Mídias (CONTEXT.md, Relação; spec `relacoes`): a seção "Relações" e o
// destaque da Sequência no Detalhe. A API (GET /midias/<id>/relacoes) já devolve as Relações
// nos dois sentidos, sem as vagas e sem as adultas; aqui ficam os nomes, a ordem, o corte dos
// jogos e a sugestão.

import { estadoDe, nomeDoRotulo, nomeDoTipo } from './estadoConsumo';
import type { NomeRelacao, RelacaoDaMidia } from './tipos';

/** O nome de cada Relação na interface, na ordem dos grupos da seção. */
export const NOMES_RELACAO: Record<NomeRelacao, string> = {
  PREQUEL: 'Prequel',
  SEQUEL: 'Sequência',
  ADAPTATION: 'Adaptação',
  SOURCE: 'Original',
  PARENT: 'Principal',
  SIDE_STORY: 'História paralela',
  SPIN_OFF: 'Spin-off',
  ALTERNATIVE: 'Versão alternativa',
  SUMMARY: 'Resumo',
  COMPILATION: 'Compilação',
  CONTAINS: 'Contém',
  MESMA_SERIE: 'Mesma série',
};

/** As Relações que levam o Tipo no nome: a Adaptação e o Original podem cruzar Tipos. */
const COM_TIPO: ReadonlySet<NomeRelacao> = new Set(['ADAPTATION', 'SOURCE']);

const GRUPOS = Object.keys(NOMES_RELACAO) as NomeRelacao[];

/** Quantos jogos da Mesma série o carrossel mostra; o resto vai para o "e mais N". */
export const LIMITE_DE_JOGOS = 12;

/** "Sequência", "Adaptação · mangá". */
export function nomeDaRelacao(relacao: Pick<RelacaoDaMidia, 'relacao' | 'tipo'>): string {
  const nome = NOMES_RELACAO[relacao.relacao] ?? relacao.relacao;
  return COM_TIPO.has(relacao.relacao) ? `${nome} · ${nomeDoTipo(relacao.tipo).toLowerCase()}` : nome;
}

/** O que o leitor de tela diz do cartão: a Relação, o título, o Tipo e o Estado do Usuário. */
export function descricaoDaRelacao(relacao: RelacaoDaMidia): string {
  const partes = [`${nomeDaRelacao(relacao)}: ${relacao.titulo}`, nomeDoTipo(relacao.tipo)];
  if (relacao.id_midia === null) partes.push('fora do Catálogo');
  else if (relacao.status_consumo) partes.push(nomeDoRotulo(relacao.status_consumo, relacao.tipo));
  return partes.join(', ');
}

function instante(data: string | null): number | null {
  if (!data) return null;
  const ms = Date.parse(data);
  return Number.isNaN(ms) ? null : ms;
}

/** Por lançamento, sem data no fim; o título desempata. */
function porLancamento(a: RelacaoDaMidia, b: RelacaoDaMidia): number {
  const [x, y] = [instante(a.data_lancamento), instante(b.data_lancamento)];
  if (x !== y) {
    if (x === null) return 1;
    if (y === null) return -1;
    return x - y;
  }
  return a.titulo.localeCompare(b.titulo, 'pt-BR');
}

/** Prequel e Sequência primeiro, depois os outros grupos (a ordem de `NOMES_RELACAO`); cada um por lançamento. */
export function ordenarRelacoes(relacoes: readonly RelacaoDaMidia[]): RelacaoDaMidia[] {
  const grupo = (r: RelacaoDaMidia) => {
    const i = GRUPOS.indexOf(r.relacao);
    return i === -1 ? GRUPOS.length : i;
  };
  return [...relacoes].sort((a, b) => grupo(a) - grupo(b) || porLancamento(a, b));
}

/** Os cartões do carrossel e quantos ficaram para a lista completa ("e mais N"). */
export type CarrosselDeRelacoes = { cartoes: RelacaoDaMidia[]; mais: number };

/**
 * O carrossel da seção. Anime e mangá: todas, em `ordenarRelacoes`. Jogo: os `LIMITE_DE_JOGOS`
 * da Mesma série mais próximos por data do jogo atual, em ordem de lançamento (sem data, os mais
 * longe); sem data no jogo atual, os primeiros por lançamento.
 */
export function carrosselDeRelacoes(
  relacoes: readonly RelacaoDaMidia[],
  midia: { tipo: string; data_lancamento: string | null },
): CarrosselDeRelacoes {
  const ordenadas = ordenarRelacoes(relacoes);
  if (midia.tipo !== 'jogo' || ordenadas.length <= LIMITE_DE_JOGOS) return { cartoes: ordenadas, mais: 0 };

  const atual = instante(midia.data_lancamento);
  const escolhidas =
    atual === null
      ? ordenadas.slice(0, LIMITE_DE_JOGOS)
      : ordenadas
          .map((relacao, posicao) => {
            const data = instante(relacao.data_lancamento);
            return { relacao, posicao, distancia: data === null ? Number.POSITIVE_INFINITY : Math.abs(data - atual) };
          })
          .sort((a, b) => (a.distancia === b.distancia ? a.posicao - b.posicao : a.distancia < b.distancia ? -1 : 1))
          .slice(0, LIMITE_DE_JOGOS)
          .sort((a, b) => a.posicao - b.posicao)
          .map((c) => c.relacao);
  return { cartoes: escolhidas, mais: ordenadas.length - escolhidas.length };
}

/** Uma Sequência sugerida; `planejavel`: está no Catálogo e pode ir para Planejado com um toque. */
export type SugestaoDeSequencia = { relacao: RelacaoDaMidia; planejavel: boolean };

/**
 * O destaque do Detalhe de um anime ou mangá Concluído: cada Sequência que não está na Lista do
 * Usuário, já lançada ou não, em ordem de lançamento. A fora do Catálogo entra sem a ação. Jogo
 * nunca tem sugestão (a ordem por data engana com remakes).
 */
export function sugestoesDeSequencia(
  midia: { tipo: string },
  item: { status_consumo: string } | null | undefined,
  relacoes: readonly RelacaoDaMidia[],
): SugestaoDeSequencia[] {
  if ((midia.tipo !== 'anime' && midia.tipo !== 'manga') || !item) return [];
  if (estadoDe(item.status_consumo, midia.tipo) !== 'concluido') return [];
  return ordenarRelacoes(relacoes.filter((r) => r.relacao === 'SEQUEL' && !r.status_consumo)).map((relacao) => ({
    relacao,
    planejavel: relacao.id_midia !== null,
  }));
}
