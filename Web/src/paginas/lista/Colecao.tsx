// Um grupo de Itens (Status × Tipo) no formato escolhido. Ponto de encaixe do ticket 02: as
// linhas (compacta e só texto) entram em FORMATOS (preferencias.ts) e aqui, com os
// cabeçalhos ordenáveis pela `ordenacao`, e o cartão de destaque por cima delas.
import type { ComponentType } from 'react';

import type { OrdemLista } from '@dominio/filtrosLista';
import type { TipoMidia } from '@dominio/estadoConsumo';

import type { ItemLista } from './api';
import { GradeCapas } from './GradeCapas';
import type { FormatoLista } from './preferencias';

/** A Ordem em vigor e como mudá-la (os cabeçalhos de coluna das linhas). */
export type Ordenacao = { ordem: OrdemLista; inversa: boolean; mudar(m: { ordem: OrdemLista; inversa: boolean }): void };

export type PropsColecao = {
  itens: readonly ItemLista[];
  /** O Tipo do grupo (as linhas chamam a coluna de "Horas" ou "Progresso" por ele). */
  tipo: TipoMidia | null;
  /** Nome acessível do grupo ("Em progresso, Anime"). */
  rotulo: string;
  ordenacao: Ordenacao;
  mudarStatus(item: ItemLista, rotulo: string): void;
};

const COLECOES: Record<FormatoLista, ComponentType<PropsColecao>> = {
  grade: GradeCapas,
};

export function Colecao({ formato, ...props }: PropsColecao & { formato: FormatoLista }) {
  const Formato = COLECOES[formato];
  return <Formato {...props} />;
}
