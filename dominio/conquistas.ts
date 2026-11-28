// Conquistas da Steam no Detalhe do jogo (CONTEXT.md, Conquista; spec `conquistas-steam`). A API
// (GET /lista/<id_lista>/conquistas) já devolve a lista na ordem, com a oculta não obtida sem nome
// nem descrição; aqui ficam os textos, o selo Rara, o destaque de Platinado e o leitor de tela.

import { formatarData } from './datas';
import type { ConquistaDoItem, ResumoConquistas } from './tipos';

/** Abaixo deste % dos jogadores, a conquista leva o selo "Rara". */
export const LIMITE_DE_RARA = 10;

/** Os textos que o web e o app mostram iguais. */
export const TEXTOS_DAS_CONQUISTAS = {
  titulo: 'Conquistas',
  resumo: (obtidas: number, total: number) => `${obtidas}/${total} conquistas`,
  oculta: 'Conquista oculta',
  rara: 'Rara',
  obtidaEm: (data: string) => `Obtida em ${data}`,
  naoObtida: 'Não obtida',
  todas: 'Você tem todas as conquistas',
  marcarPlatinado: 'Marcar Platinado',
  vazia: 'A Steam ainda não mandou as conquistas deste jogo.',
} as const;

/** "34/50 conquistas", ou null no jogo sem dado (sem leitura ou sem conquistas). */
export function textoDoResumo(resumo: ResumoConquistas | null | undefined): string | null {
  if (!resumo || resumo.total <= 0) return null;
  return TEXTOS_DAS_CONQUISTAS.resumo(resumo.obtidas, resumo.total);
}

export function eRara(raridade: number | null | undefined): boolean {
  return raridade !== null && raridade !== undefined && raridade < LIMITE_DE_RARA;
}

/** "3,2% dos jogadores", com uma casa; null sem raridade. */
export function textoDaRaridade(raridade: number | null | undefined): string | null {
  if (raridade === null || raridade === undefined) return null;
  return `${raridade.toFixed(1).replace('.', ',')}% dos jogadores`;
}

/** O nome, ou "Conquista oculta" na oculta ainda não obtida (a API não manda o nome dela). */
export function nomeDaConquista(conquista: Pick<ConquistaDoItem, 'nome'>): string {
  return conquista.nome ?? TEXTOS_DAS_CONQUISTAS.oculta;
}

/** "Obtida em 10/12/2020", "Não obtida", ou null na obtida sem data. */
export function textoDaObtencao(conquista: Pick<ConquistaDoItem, 'obtida' | 'obtida_em'>): string | null {
  if (!conquista.obtida) return TEXTOS_DAS_CONQUISTAS.naoObtida;
  const data = formatarData(conquista.obtida_em);
  return data ? TEXTOS_DAS_CONQUISTAS.obtidaEm(data) : null;
}

/**
 * O destaque "Você tem todas as conquistas" com "Marcar Platinado": com 100% e o Item fora de
 * Platinado, em qualquer Estado (Platinado inclui Concluído). Nunca marca sozinho (ADR 0015).
 */
export function sugereMarcarPlatinado(
  item: { status_consumo: string; conquistas?: ResumoConquistas | null } | null | undefined,
): boolean {
  const resumo = item?.conquistas;
  return !!resumo && resumo.total > 0 && resumo.obtidas >= resumo.total && item.status_consumo !== 'platinado';
}

/** O que o leitor de tela diz da conquista: nome, jogo, se foi obtida (e quando) e a raridade. */
export function descricaoAcessivel(conquista: ConquistaDoItem, jogo: string): string {
  const data = conquista.obtida ? formatarData(conquista.obtida_em) : null;
  const obtencao = conquista.obtida ? (data ? `obtida em ${data}` : 'obtida') : 'não obtida';
  const partes = [nomeDaConquista(conquista), jogo, obtencao, textoDaRaridade(conquista.raridade)];
  if (eRara(conquista.raridade)) partes.push('rara');
  return partes.filter((p): p is string => !!p).join(', ');
}
