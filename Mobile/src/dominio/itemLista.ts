// Regras do Item de lista (CONTEXT.md: Item de lista, Progresso, Recontagem, Nota pessoal).
// Cópia do que Backend/dominio/lista_pessoal.py decide: o backend segue autoritativo
// (ADR 0002, 0004); aqui servem para o otimista do stepper e a validação do editor.

import { formatarData } from './datas';
import {
  type EstadoConsumo,
  estadoDe,
  ROTULOS_POR_TIPO,
  rotuloPara,
  type TipoMidia,
} from './estadoConsumo';

/** Jogos não têm Progresso mensurável: o campo guarda horas, que nunca concluem. */
export function temProgresso(tipo: string): boolean {
  return tipo === 'anime' || tipo === 'manga';
}

type ComTotal = {
  tipo: string;
  progresso_total?: number | null;
  numero_episodios?: number | null;
  numero_capitulos?: number | null;
};

/** Total de episódios/capítulos contra o qual o Progresso é medido; null se não se sabe. */
export function totalDoItem(item: ComTotal): number | null {
  if (!temProgresso(item.tipo)) return null;
  if (item.progresso_total != null) return item.progresso_total;
  const daMidia = item.tipo === 'anime' ? item.numero_episodios : item.numero_capitulos;
  return daMidia ?? null;
}

/** Próximo Progresso ao tocar − (−1) ou + (+1); null se o toque não é permitido. */
export function passoDeProgresso(
  item: ComTotal & { progresso_atual: number | null },
  delta: 1 | -1,
): number | null {
  if (!temProgresso(item.tipo)) return null;
  const novo = (item.progresso_atual ?? 0) + delta;
  const total = totalDoItem(item);
  if (novo < 0 || (total !== null && novo > total)) return null;
  return novo;
}

function eTerminal(rotulo: string, tipo: string): boolean {
  const estado = estadoDe(rotulo, tipo);
  return estado === 'concluido' || estado === 'platinado';
}

/**
 * O Item como o backend o deixará após gravar `progresso`: atingir o total leva a
 * Concluído (com a data de hoje, se ainda não há), e um Item terminal não é rebaixado.
 */
export function aplicarProgresso<
  T extends ComTotal & { progresso_atual: number | null; status_consumo: string; data_conclusao: string | null },
>(item: T, progresso: number, hoje: string): T {
  const novo = { ...item, progresso_atual: progresso };
  const total = totalDoItem(item);
  if (total === null || total <= 0 || progresso < total || eTerminal(item.status_consumo, item.tipo)) {
    return novo;
  }
  return {
    ...novo,
    status_consumo: rotuloPara('concluido', item.tipo as TipoMidia) ?? item.status_consumo,
    data_conclusao: item.data_conclusao || hoje,
  };
}

/** Rótulo com que uma Mídia entra na Lista: o Planejado do Tipo. */
export function rotuloInicial(tipo: TipoMidia): string {
  return ROTULOS_POR_TIPO[tipo].planejado as string;
}

/** Ordem das abas da Lista: o que se acompanha agora vem primeiro. */
const ORDEM_ABAS: readonly EstadoConsumo[] = [
  'em_progresso',
  'planejado',
  'pausado',
  'abandonado',
  'concluido',
  'platinado',
];

/** Estados que viram aba para os Tipos do Recorte (Platinado só existe para jogo). */
export function estadosDaLista(tipos: readonly TipoMidia[]): EstadoConsumo[] {
  return ORDEM_ABAS.filter((estado) => tipos.some((tipo) => ROTULOS_POR_TIPO[tipo][estado]));
}

/** Itens de uma aba. A aba Concluído inclui os platinados. */
export function itensDoEstado<T extends { tipo: string; status_consumo: string }>(
  itens: readonly T[],
  estado: EstadoConsumo,
): T[] {
  return itens.filter((item) => {
    const doItem = estadoDe(item.status_consumo, item.tipo);
    return doItem === estado || (estado === 'concluido' && doItem === 'platinado');
  });
}

// ---------------------------------------------------------------- editor

export type FormularioItem = {
  status_consumo: string;
  progresso: string;
  nota: string;
  favorito: boolean;
  privado: boolean;
  /** dd/mm/aaaa ou vazio. */
  inicio: string;
  conclusao: string;
  recontagem: string;
  comentario: string;
};

/** Corpo de POST /lista/adicionar (mais `id_midia`) e de PUT /lista/<id_lista>. */
export type DadosItem = {
  status_consumo: string;
  progresso_atual: number;
  nota_usuario: number | null;
  favorito: boolean;
  privado: boolean;
  /** "2026-10-01" ou null. */
  data_inicio: string | null;
  data_conclusao: string | null;
  total_rewatches: number;
  comentario: string | null;
};

type ItemDaApi = {
  status_consumo: string;
  progresso_atual: number | null;
  nota_usuario: number | string | null;
  favorito?: boolean | number | null;
  privado?: boolean | number | null;
  data_inicio?: string | null;
  data_conclusao?: string | null;
  total_rewatches?: number | null;
  comentario?: string | null;
};

export function formularioDoItem(item: ItemDaApi | null, tipo: TipoMidia): FormularioItem {
  if (!item) {
    return {
      status_consumo: rotuloInicial(tipo),
      progresso: '0',
      nota: '',
      favorito: false,
      privado: false,
      inicio: '',
      conclusao: '',
      recontagem: '0',
      comentario: '',
    };
  }
  return {
    status_consumo: item.status_consumo,
    progresso: String(item.progresso_atual ?? 0),
    nota: item.nota_usuario == null || item.nota_usuario === '' ? '' : String(Number(item.nota_usuario)),
    favorito: Boolean(item.favorito),
    privado: Boolean(item.privado),
    inicio: formatarData(item.data_inicio) ?? '',
    conclusao: formatarData(item.data_conclusao) ?? '',
    recontagem: String(item.total_rewatches ?? 0),
    comentario: item.comentario ?? '',
  };
}

/** `nota_usuario` é DECIMAL(3,2): acima de 9,99 o banco recusa (e o backend responde 500). */
export const NOTA_PESSOAL_MAXIMA = 9.99;

const INTEIRO = /^\d+$/;

/** "dd/mm/aaaa" → "aaaa-mm-dd"; vazio → null; inválido → undefined. */
function dataIso(texto: string): string | null | undefined {
  const t = texto.trim();
  if (!t) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (!m) return undefined;
  const [, dia, mes, ano] = m;
  const data = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)));
  if (data.getUTCDate() !== Number(dia) || data.getUTCMonth() !== Number(mes) - 1) return undefined;
  return `${ano}-${mes}-${dia}`;
}

export type ResultadoItem = { ok: true; dados: DadosItem } | { ok: false; erro: string };

export function validarItem(f: FormularioItem, midia: { tipo: TipoMidia; total: number | null }): ResultadoItem {
  const falha = (erro: string): ResultadoItem => ({ ok: false, erro });

  if (!estadoDe(f.status_consumo, midia.tipo)) {
    return falha('Escolha um Estado de consumo válido para o Tipo.');
  }

  const textoProgresso = f.progresso.trim() || '0';
  const progresso = Number(textoProgresso);
  const teto = temProgresso(midia.tipo) ? midia.total : null;
  if (!INTEIRO.test(textoProgresso) || (teto !== null && progresso > teto)) {
    if (!temProgresso(midia.tipo)) return falha('As horas jogadas são um número inteiro a partir de 0.');
    return falha(teto !== null ? `O Progresso vai de 0 a ${teto}.` : 'O Progresso é um número inteiro a partir de 0.');
  }

  let nota: number | null = null;
  const textoNota = f.nota.trim().replace(',', '.');
  if (textoNota) {
    nota = Number(textoNota);
    if (Number.isNaN(nota) || nota < 0 || nota > NOTA_PESSOAL_MAXIMA) {
      return falha('A Nota pessoal vai de 0 a 9,99.');
    }
  }

  const textoRecontagem = f.recontagem.trim() || '0';
  if (!INTEIRO.test(textoRecontagem)) return falha('A Recontagem é um número inteiro a partir de 0.');

  const inicio = dataIso(f.inicio);
  if (inicio === undefined) return falha('Data de início inválida (dd/mm/aaaa).');
  const conclusao = dataIso(f.conclusao);
  if (conclusao === undefined) return falha('Data de conclusão inválida (dd/mm/aaaa).');
  if (inicio && conclusao && conclusao < inicio) return falha('A conclusão não pode ser antes do início.');

  return {
    ok: true,
    dados: {
      status_consumo: f.status_consumo,
      progresso_atual: progresso,
      nota_usuario: nota,
      favorito: f.favorito,
      privado: f.privado,
      data_inicio: inicio,
      data_conclusao: conclusao,
      total_rewatches: Number(textoRecontagem),
      comentario: f.comentario.trim() || null,
    },
  };
}

/** Unidade do Progresso, para rótulos ("Episódios", "Capítulos", "Horas jogadas"). */
export function nomeDoProgresso(tipo: string): string {
  if (tipo === 'anime') return 'Episódios';
  if (tipo === 'manga') return 'Capítulos';
  return 'Horas jogadas';
}
