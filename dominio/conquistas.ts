// Conquistas da Steam no Detalhe do jogo e no Perfil (CONTEXT.md, Conquista; spec `conquistas-steam`).
// A API (GET /lista/<id_lista>/conquistas) já devolve a lista na ordem, com a oculta não obtida sem
// nome nem descrição, e os destaques do Perfil (GET /usuario/conquistas/destaques) já escolhidos e
// ordenados; aqui ficam os textos, o selo Rara, o destaque de Platinado, o leitor de tela e a query e
// as páginas do seletor de destaques (GET /usuario/conquistas).

import { formatarData } from './datas';
import type {
  CodigoErro,
  ConquistaDoItem,
  ConsultaConquistas,
  ResumoConquistas,
  TotalDeConquistas,
} from './tipos';

/** Quantas conquistas o Usuário destaca no Perfil (o servidor recusa a sétima com 409). */
export const LIMITE_DE_DESTAQUES = 6;

const LIMITE_DE_DESTAQUES_ATINGIDO = 'limite_de_destaques' satisfies CodigoErro;

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
  emDestaque: 'Conquistas em destaque',
  destacar: 'Destacar no Perfil',
  tirar: 'Tirar do Perfil',
  dicaAutomaticos: `Estas são as suas conquistas mais raras. Escolha até ${LIMITE_DE_DESTAQUES} para destacar no Perfil.`,
  limiteDeDestaques: `O Perfil já tem ${LIMITE_DE_DESTAQUES} destaques. Tire um antes de destacar outro.`,
  escolherDestaques: 'Escolher destaques',
  buscar: 'Buscar pelo nome',
  jogo: 'Jogo',
  todosOsJogos: 'Todos os jogos',
  soDestacadas: 'Só as destacadas',
  ordenarPor: 'Ordenar por',
  carregarMais: 'Carregar mais',
  nenhumaNoSeletor: 'Nenhuma conquista obtida com esses filtros.',
  obtidas: 'Conquistas obtidas',
} as const;

/**
 * Os rótulos das ordens do seletor de destaques: a mais rara primeiro (o padrão) ou a obtida mais recente.
 * Como cada uma ordena é do servidor (`ORDENS_DO_SELETOR` em `Backend/repositories/destaques.py`); os
 * valores vêm do contrato.
 */
export const ORDENS_DO_SELETOR = [
  { valor: 'raridade', rotulo: 'Mais raras' },
  { valor: 'data', rotulo: 'Mais recentes' },
] as const satisfies readonly { valor: NonNullable<ConsultaConquistas['ordem']>; rotulo: string }[];

export type OrdemDoSeletor = (typeof ORDENS_DO_SELETOR)[number]['valor'];

/** O que o Usuário escolhe no seletor; `steamAppid` null para todos os jogos. */
export type FiltrosDoSeletor = {
  busca: string;
  steamAppid: number | null;
  soDestacadas: boolean;
  ordem: OrdemDoSeletor;
};

export const FILTROS_INICIAIS_DO_SELETOR: FiltrosDoSeletor = {
  busca: '',
  steamAppid: null,
  soDestacadas: false,
  ordem: 'raridade',
};

/** A query de GET /usuario/conquistas numa página, só com os filtros escolhidos (a busca aparada). */
export function consultaDoSeletor(filtros: FiltrosDoSeletor, pagina: number): ConsultaConquistas {
  const consulta: ConsultaConquistas = { ordem: filtros.ordem, pagina };
  const busca = filtros.busca.trim();
  if (busca) consulta.busca = busca;
  if (filtros.steamAppid !== null) consulta.steam_appid = filtros.steamAppid;
  if (filtros.soDestacadas) consulta.so_destacadas = true;
  return consulta;
}

/** A página seguinte do seletor, ou undefined quando as lidas já somam o total. */
export function proximaPaginaDoSeletor(ultima: { pagina: number; por_pagina: number; total: number }) {
  return ultima.pagina * ultima.por_pagina >= ultima.total ? undefined : ultima.pagina + 1;
}

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
export function descricaoAcessivel(
  conquista: Pick<ConquistaDoItem, 'nome' | 'obtida' | 'obtida_em' | 'raridade'>,
  jogo: string,
): string {
  const data = conquista.obtida ? formatarData(conquista.obtida_em) : null;
  const obtencao = conquista.obtida ? (data ? `obtida em ${data}` : 'obtida') : 'não obtida';
  const partes = [nomeDaConquista(conquista), jogo, obtencao, textoDaRaridade(conquista.raridade)];
  if (eRara(conquista.raridade)) partes.push('rara');
  return partes.filter((p): p is string => !!p).join(', ');
}

/** "412 conquistas em 37 jogos", ou null sem nenhuma obtida. */
export function textoDoTotal(total: TotalDeConquistas): string | null {
  if (total.conquistas <= 0) return null;
  const conquistas = `${total.conquistas} ${total.conquistas === 1 ? 'conquista' : 'conquistas'}`;
  return `${conquistas} em ${total.jogos} ${total.jogos === 1 ? 'jogo' : 'jogos'}`;
}

/** A seção "Conquistas em destaque" aparece só com alguma conquista obtida. */
export function mostraDestaquesNoPerfil(resposta: { total: TotalDeConquistas } | null | undefined): boolean {
  return !!resposta && resposta.total.conquistas > 0;
}

/** O erro do servidor é o da sétima conquista em destaque (409). */
export function eLimiteDeDestaques(erro: unknown): boolean {
  return (
    typeof erro === 'object' && erro !== null && (erro as { codigo?: unknown }).codigo === LIMITE_DE_DESTAQUES_ATINGIDO
  );
}
