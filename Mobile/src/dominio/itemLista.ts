// Regras do Item de lista (CONTEXT.md: Item de lista, Progresso, Recontagem, Nota pessoal).
// Cópia do que Backend/dominio/lista_pessoal.py decide: o backend segue autoritativo
// (ADR 0002, 0004, 0009); aqui servem para o otimista do stepper e o editor.

import { formatarData } from './datas';
import { lerNota } from './nota';
import {
  type EstadoConsumo,
  estadoDe,
  ROTULOS_POR_TIPO,
  rotuloPara,
  type TipoMidia,
} from './estadoConsumo';

/** Jogos não têm Progresso mensurável: o campo guarda horas, que nunca concluem. */
export function temProgresso(tipo: TipoMidia): boolean {
  return tipo === 'anime' || tipo === 'manga';
}

type ComTotal = {
  tipo: TipoMidia;
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

function eConcluido(rotulo: string | null | undefined, tipo: TipoMidia): boolean {
  return rotulo != null && estadoDe(rotulo, tipo) === 'concluido';
}

/**
 * Concluído ⇔ Progresso = total (ADR 0009); cópia de `_concluido_segue_o_progresso`.
 * Escolher Concluído leva o Progresso ao total; atingir o total leva a Concluído; abaixo
 * dele, um Concluído volta ao Em progresso do Tipo. Sem total (ou jogo), nada muda.
 * `entrou` diz se o Item passou a Concluído vindo de outro Estado.
 */
function concluidoSegueOProgresso(
  tipo: TipoMidia,
  total: number | null,
  antes: string,
  pedido: { status_consumo: string; progresso_atual: number },
): { status_consumo: string; progresso_atual: number; entrou: boolean } {
  const igual = { ...pedido, entrou: false };
  if (!temProgresso(tipo) || total === null || total <= 0) return igual;
  const jaConcluido = eConcluido(antes, tipo);
  const concluido = eConcluido(pedido.status_consumo, tipo);
  if (concluido && !jaConcluido) return { ...pedido, progresso_atual: total, entrou: true };
  if (pedido.progresso_atual >= total && !concluido) {
    return { ...pedido, status_consumo: rotuloPara('concluido', tipo) ?? pedido.status_consumo, entrou: !jaConcluido };
  }
  if (pedido.progresso_atual < total && concluido) {
    return { ...pedido, status_consumo: rotuloPara('em_progresso', tipo) ?? pedido.status_consumo, entrou: false };
  }
  return igual;
}

/**
 * O Item como o backend o deixará após gravar `progresso` (ADR 0009): no total vira
 * Concluído; entrar em Concluído grava a data de hoje e, se já havia conclusão, soma +1 na
 * Recontagem; abaixo do total um Concluído volta a Em progresso, com a data mantida.
 */
export function aplicarProgresso<
  T extends ComTotal & {
    progresso_atual: number | null;
    status_consumo: string;
    data_conclusao: string | null;
    total_rewatches?: number | null;
  },
>(item: T, progresso: number, hoje: string): T {
  const r = concluidoSegueOProgresso(item.tipo, totalDoItem(item), item.status_consumo, {
    status_consumo: item.status_consumo,
    progresso_atual: progresso,
  });
  const novo = { ...item, progresso_atual: r.progresso_atual, status_consumo: r.status_consumo };
  if (!r.entrou) return novo;
  return {
    ...novo,
    data_conclusao: hoje,
    // Concluir de novo no mesmo dia da conclusão anterior desfaz um toque errado: não conta.
    total_rewatches:
      item.data_conclusao && item.data_conclusao.slice(0, 10) !== hoje
        ? (item.total_rewatches ?? 0) + 1
        : item.total_rewatches,
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
export function itensDoEstado<T extends { tipo: TipoMidia; status_consumo: string }>(
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
  nota_usuario: number | null;
  favorito?: boolean | null;
  privado?: boolean | null;
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
    nota: item.nota_usuario == null ? '' : String(item.nota_usuario),
    favorito: Boolean(item.favorito),
    privado: Boolean(item.privado),
    inicio: formatarData(item.data_inicio) ?? '',
    conclusao: formatarData(item.data_conclusao) ?? '',
    recontagem: String(item.total_rewatches ?? 0),
    comentario: item.comentario ?? '',
  };
}

const INTEIRO = /^\d+$/;

/** "dd/mm/aaaa" (escrito pelo calendário do editor) → "aaaa-mm-dd"; vazio → null. */
function dataIso(texto: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

export type ResultadoItem = { ok: true; dados: DadosItem } | { ok: false; erro: string };

/**
 * O formulário depois de uma mudança, com Estado e Progresso acoplados (ADR 0009): a tela
 * mostra o que o backend gravará. Data de conclusão e Recontagem ficam com o backend, que
 * as decide contra o Item guardado.
 */
export function ajustarFormulario(
  antes: FormularioItem,
  depois: FormularioItem,
  midia: { tipo: TipoMidia; total: number | null },
): FormularioItem {
  const texto = depois.progresso.trim() || '0';
  if (!INTEIRO.test(texto)) return depois;
  const r = concluidoSegueOProgresso(midia.tipo, midia.total, antes.status_consumo, {
    status_consumo: depois.status_consumo,
    progresso_atual: Number(texto),
  });
  return {
    ...depois,
    status_consumo: r.status_consumo,
    progresso: r.progresso_atual === Number(texto) ? depois.progresso : String(r.progresso_atual),
  };
}

/**
 * Estado do editor aberto: o formulário e o Progresso de antes de o Item entrar em Concluído
 * nesta edição (null se não entrou).
 */
export type EdicaoItem = { form: FormularioItem; progressoAntesDoConcluido: string | null };

export function iniciarEdicao(item: ItemDaApi | null, tipo: TipoMidia): EdicaoItem {
  return { form: formularioDoItem(item, tipo), progressoAntesDoConcluido: null };
}

/**
 * Uma mudança no editor (ticket 33). Além do acoplamento de `ajustarFormulario`, sair de
 * Concluído escolhendo outro Estado não pode deixar o Progresso no total (o que forçaria
 * Concluído de novo): volta ao Progresso de antes de entrar em Concluído nesta edição, ou a 0
 * se o Item já abriu concluído (nova passagem; reconcluir soma Recontagem, ADR 0009).
 */
export function mudarEdicao(
  edicao: EdicaoItem,
  mudanca: Partial<FormularioItem>,
  midia: { tipo: TipoMidia; total: number | null },
): EdicaoItem {
  const antes = edicao.form;
  const depois = { ...antes, ...mudanca };
  const estavaConcluido = eConcluido(antes.status_consumo, midia.tipo);
  const comTotal = temProgresso(midia.tipo) && midia.total !== null && midia.total > 0;
  if (comTotal && estavaConcluido && mudanca.status_consumo !== undefined && !eConcluido(mudanca.status_consumo, midia.tipo)) {
    return { form: { ...depois, progresso: edicao.progressoAntesDoConcluido ?? '0' }, progressoAntesDoConcluido: null };
  }
  const form = ajustarFormulario(antes, depois, midia);
  const concluido = eConcluido(form.status_consumo, midia.tipo);
  let memoria = edicao.progressoAntesDoConcluido;
  if (!estavaConcluido && concluido) memoria = antes.progresso;
  else if (!concluido) memoria = null;
  return { form, progressoAntesDoConcluido: memoria };
}

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
  if (f.nota.trim()) {
    nota = lerNota(f.nota);
    if (nota === null) return falha('A Nota pessoal vai de 0 a 10, com no máximo uma casa decimal.');
  }

  const textoRecontagem = f.recontagem.trim() || '0';
  if (!INTEIRO.test(textoRecontagem)) return falha('A Recontagem é um número inteiro a partir de 0.');

  const inicio = dataIso(f.inicio);
  const conclusao = dataIso(f.conclusao);
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
