// O que a Lista mostra, na ordem da tela: a base do corpo (CorpoLista.tsx) e do foco depois
// de mudar o Status (focoDaLista.ts), para os dois verem a mesma ordem.
import type { EstadoConsumo, TipoMidia } from '@dominio/estadoConsumo';
import { porTipo, secoesPorStatus, type TipoDaLista, tiposDoFiltro } from '@dominio/filtrosLista';
import { itensDoEstado } from '@dominio/itemLista';

import type { ItemLista } from './api';
import type { StatusEscolhido } from './ColunaLateral';

export type Grupo = { tipo: TipoMidia | null; itens: ItemLista[] };
export type SecaoNaTela = { estado: EstadoConsumo; grupos: Grupo[] };

/**
 * O que a tela mostra, na ordem da tela: no "Todos", uma seção por Status (sem as vazias);
 * num Status, só ele. Cada seção em grupos por Tipo (um só, sem Tipo, com um Tipo escolhido).
 */
export function secoesNaTela(itens: readonly ItemLista[], ativo: StatusEscolhido, estados: readonly EstadoConsumo[], tipo: TipoDaLista): SecaoNaTela[] {
  const secoes = ativo === 'todos' ? secoesPorStatus(itens, estados) : [{ estado: ativo, itens: itensDoEstado(itens, ativo) }];
  return secoes.map(({ estado, itens: doStatus }) => ({
    estado,
    grupos: doStatus.length ? porTipo(doStatus, tiposDoFiltro(tipo)) : [],
  }));
}

/** Os `id_lista` na ordem da tela. */
export const idsNaTela = (secoes: readonly SecaoNaTela[]) => secoes.flatMap((s) => s.grupos.flatMap((g) => g.itens.map((i) => i.id_lista)));

