// Opções fixas dos filtros do Catálogo (`GET /midias`) que são enums no banco: Situação por
// Tipo, Modo de jogo e Demografia. As que não são enum (Gênero, Plataforma, Estúdio) vêm da API
// ou são texto livre. Os tipos amarram cada lista ao enum do contrato.

import type { TipoMidia } from './estadoConsumo';
import { nomeDaSituacao } from './situacao';
import type { Midia } from './tipos';

export type OpcaoDeFiltro<V extends string = string> = { valor: V; nome: string };

type Situacao<T extends TipoMidia> = NonNullable<Midia[`status_${T}`]>;

function comNome<V extends string>(valores: readonly V[], nome: (v: V) => string): OpcaoDeFiltro<V>[] {
  return valores.map((valor) => ({ valor, nome: nome(valor) }));
}

const ANIME: Situacao<'anime'>[] = ['em_exibicao', 'finalizado', 'aguardando', 'cancelado'];
const MANGA: Situacao<'manga'>[] = ['em_publicacao', 'finalizado', 'aguardando', 'hiato', 'cancelado'];
const JOGO: Situacao<'jogo'>[] = ['lancado', 'em_desenvolvimento', 'remasterizado', 'cancelado'];

/** Situações (status de lançamento) de cada Tipo, na ordem dos filtros. */
export const SITUACOES_DO_TIPO: Record<TipoMidia, OpcaoDeFiltro[]> = {
  anime: comNome(ANIME, nomeDaSituacao),
  manga: comNome(MANGA, nomeDaSituacao),
  jogo: comNome(JOGO, nomeDaSituacao),
};

export type ModoDeJogo = NonNullable<Midia['modo_jogo']>;

export const MODOS_DE_JOGO: OpcaoDeFiltro<ModoDeJogo>[] = [
  { valor: 'single', nome: 'Um jogador' },
  { valor: 'multi', nome: 'Multijogador' },
  { valor: 'ambos', nome: 'Os dois' },
];

export type Demografia = NonNullable<Midia['demografia']>;

export const DEMOGRAFIAS: OpcaoDeFiltro<Demografia>[] = [
  { valor: 'shounen', nome: 'Shounen' },
  { valor: 'shoujo', nome: 'Shoujo' },
  { valor: 'seinen', nome: 'Seinen' },
  { valor: 'josei', nome: 'Josei' },
  { valor: 'kodomomuke', nome: 'Kodomomuke' },
];
