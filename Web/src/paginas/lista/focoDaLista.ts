// Foco depois de mudar o Status pelo menu ⋯ (revisão do ticket 39): o Item muda de lugar (ou
// sai da vista), e o foco não pode cair no vazio. A Lista decide o alvo (`alvoDoFoco`) e
// entrega o Item ao contexto; a grade virtualizada que o tem rola até ele e foca o menu de
// Status dele (`ATRIBUTO_FOCO`).
import { createContext, useContext } from 'react';

import type { EstadoConsumo } from '@dominio/estadoConsumo';

/** O botão do menu de Status leva o `id_lista` do Item neste atributo. */
export const ATRIBUTO_FOCO = 'data-foco-item';

/** O cabeçalho fixo (o Status ativo): o foco de último caso. */
export const ID_CABECALHO = 'cabecalho-da-lista';

/** O separador de um Status no "Todos". */
export const idDaSecao = (estado: EstadoConsumo) => `secao-${estado}`;

/** Uma mudança de Status pedida, à espera de aparecer na Lista. */
export type MudancaPendente = {
  id: string;
  /** O `status_consumo` antes da mudança: quando o da Lista for outro, ela chegou. */
  antes: string;
  /** Os vizinhos na tela no momento da mudança: o seguinte e depois o anterior. */
  vizinhos: string[];
  /** O Status em que o Item estava na tela (o separador dele no "Todos"). */
  secao: EstadoConsumo;
  /** "<título> movido para <Status>". */
  anuncio: string;
};

export type AlvoDoFoco = { item: string } | { cabecalho: string };

/** Os vizinhos de `id` na ordem da tela: o seguinte, depois o anterior. */
export function vizinhosNaTela(naTela: readonly string[], id: string): string[] {
  const i = naTela.indexOf(id);
  if (i < 0) return [];
  return [naTela[i + 1], naTela[i - 1]].filter((v): v is string => v !== undefined);
}

/**
 * Para onde vai o foco: o mesmo Item, se continua na tela; senão o vizinho que continua (o
 * seguinte, senão o anterior); senão o separador da seção dele (no "Todos") ou o cabeçalho.
 */
export function alvoDoFoco(mudanca: MudancaPendente, naTela: readonly string[], separadores: readonly EstadoConsumo[]): AlvoDoFoco {
  const visivel = new Set(naTela);
  const item = [mudanca.id, ...mudanca.vizinhos].find((id) => visivel.has(id));
  if (item) return { item };
  return { cabecalho: separadores.includes(mudanca.secao) ? idDaSecao(mudanca.secao) : ID_CABECALHO };
}

type Foco = { alvo: string | null; focado(): void };

export const FocoDaLista = createContext<Foco>({ alvo: null, focado: () => {} });

export const useFocoDaLista = () => useContext(FocoDaLista);
