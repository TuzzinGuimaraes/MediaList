// Estado de consumo e Rótulos de estado (CONTEXT.md). Cópia de
// Backend/schemas/estado_consumo.py: o backend continua autoritativo (ADR 0002).

export type TipoMidia = 'anime' | 'manga' | 'jogo';

export const TIPOS: readonly TipoMidia[] = ['anime', 'manga', 'jogo'];

export const NOMES_TIPO: Record<TipoMidia, string> = { anime: 'Anime', manga: 'Mangá', jogo: 'Jogo' };

export type EstadoConsumo =
  | 'planejado'
  | 'em_progresso'
  | 'pausado'
  | 'abandonado'
  | 'concluido'
  | 'platinado';

export const ESTADOS: readonly EstadoConsumo[] = [
  'planejado',
  'em_progresso',
  'pausado',
  'abandonado',
  'concluido',
  'platinado',
];

export const NOMES_ESTADO: Record<EstadoConsumo, string> = {
  planejado: 'Planejado',
  em_progresso: 'Em progresso',
  pausado: 'Pausado',
  abandonado: 'Abandonado',
  concluido: 'Concluído',
  platinado: 'Platinado',
};

/** Rótulo de cada estado, por Tipo. Estado ausente não se aplica ao Tipo (só jogo tem Platinado). */
export const ROTULOS_POR_TIPO: Record<TipoMidia, Partial<Record<EstadoConsumo, string>>> = {
  anime: {
    planejado: 'planejado',
    em_progresso: 'assistindo',
    pausado: 'pausado',
    abandonado: 'abandonado',
    concluido: 'completo',
  },
  manga: {
    planejado: 'planejado',
    em_progresso: 'lendo',
    pausado: 'pausado',
    abandonado: 'abandonado',
    concluido: 'lido',
  },
  jogo: {
    planejado: 'na_fila',
    em_progresso: 'jogando',
    pausado: 'pausado',
    abandonado: 'abandonado',
    concluido: 'zerado',
    platinado: 'platinado',
  },
};

/** Rótulos válidos para o Tipo, na ordem dos estados. */
export function rotulosDoTipo(tipo: TipoMidia): string[] {
  return ESTADOS.flatMap((estado) => ROTULOS_POR_TIPO[tipo][estado] ?? []);
}

export function rotuloPara(estado: EstadoConsumo, tipo: TipoMidia): string | null {
  return ROTULOS_POR_TIPO[tipo][estado] ?? null;
}

/** Estado de consumo por trás do rótulo, ou null se o rótulo não vale para o Tipo. */
export function estadoDe(rotulo: string | null | undefined, tipo: TipoMidia): EstadoConsumo | null {
  const rotulos = ROTULOS_POR_TIPO[tipo];
  if (!rotulo || !rotulos) return null;
  return ESTADOS.find((estado) => rotulos[estado] === rotulo) ?? null;
}

export type ContagemPorEstado = Record<EstadoConsumo, number>;

/**
 * Núcleo das contagens por Estado de consumo: soma `quantidade` no Estado de cada
 * entrada; rótulo que não vale para o Tipo fica de fora. Platinado é refinamento de
 * Concluído: soma em `platinado` e também em `concluido`.
 */
function acumularPorEstado<T>(
  entradas: readonly T[],
  ler: (entrada: T) => { rotulo: string | null; tipo: TipoMidia; quantidade: number },
): ContagemPorEstado {
  const contagem = Object.fromEntries(ESTADOS.map((e) => [e, 0])) as ContagemPorEstado;
  for (const entrada of entradas) {
    const { rotulo, tipo, quantidade } = ler(entrada);
    const estado = estadoDe(rotulo, tipo);
    if (!estado) continue;
    contagem[estado] += quantidade;
    if (estado === 'platinado') contagem.concluido += quantidade;
  }
  return contagem;
}

/** Conta Itens por Estado de consumo; cada Item platinado conta também em Concluído. */
export function contarPorEstado(
  itens: readonly { tipo: TipoMidia; status_consumo: string | null }[],
): ContagemPorEstado {
  return acumularPorEstado(itens, (item) => ({ rotulo: item.status_consumo, tipo: item.tipo, quantidade: 1 }));
}

/** Média das Notas pessoais dadas; null se nenhum Item tem nota. */
export function mediaNotasPessoais(
  itens: readonly { nota_usuario: number | null }[],
): number | null {
  const notas = itens.map((i) => i.nota_usuario).filter((n): n is number => n !== null);
  if (notas.length === 0) return null;
  return notas.reduce((soma, n) => soma + n, 0) / notas.length;
}


/** Nome de apresentação do Estado por trás do rótulo; rótulo desconhecido passa como veio. */
export function nomeDoRotulo(rotulo: string, tipo: TipoMidia): string {
  const estado = estadoDe(rotulo, tipo);
  return estado ? NOMES_ESTADO[estado] : rotulo;
}

/**
 * Soma linhas já agregadas (ex.: GET /midias/<id>/distribuicao) por Estado de consumo,
 * na ordem dos estados, omitindo os vazios. Platinado também soma em Concluído.
 */
export function somarPorEstado(
  linhas: readonly { status_consumo: string; total: number }[],
  tipo: TipoMidia,
): { estado: EstadoConsumo; nome: string; total: number }[] {
  const contagem = acumularPorEstado(linhas, (linha) => ({
    rotulo: linha.status_consumo,
    tipo,
    quantidade: linha.total,
  }));
  return ESTADOS.filter((e) => contagem[e] > 0).map((estado) => ({
    estado,
    nome: NOMES_ESTADO[estado],
    total: contagem[estado],
  }));
}
