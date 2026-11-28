// Tipos da API que o domínio lê, recortados de contrato/api.d.ts (gerado com `make api-tipos`,
// ADR 0011). Não escrever tipo de resposta à mão aqui.

import type { components } from '../contrato/api';

type Esquemas = components['schemas'];

export type NivelAcesso = Esquemas['Permissoes']['nivel_acesso'];

/** O `codigo` do envelope de erro da API (ADR 0011). */
export type CodigoErro = Esquemas['CodigoErro'];

/** A Mídia das listagens (GET /midias, /midias/trending): os campos de todos os Tipos. */
export type Midia = Esquemas['Midia'];

/** A query de GET /midias (Tipo, filtros, ordem e página). */
export type ConsultaMidias = Esquemas['ConsultaMidias'];

/** Um Item de GET /lista: a parte da Mídia mais os campos do Item. */
export type ItemLista = Esquemas['ItemLista'];

/** O resumo das conquistas da Steam no Item ("34/50 conquistas"). */
export type ResumoConquistas = Esquemas['ResumoConquistas'];

/** Uma conquista de GET /lista/<id_lista>/conquistas (CONTEXT.md, Conquista). */
export type ConquistaDoItem = Esquemas['ConquistaDoItem'];

/** Um episódio de GET /midias/calendario (exibido ou próximo), com o anime resumido. */
export type EpisodioDoCalendario = Esquemas['EpisodioDoCalendario'];

/** As notas de uma Mídia (CONTEXT.md: Nota média, Nota da fonte), em qualquer listagem. */
export type NotasDaMidia = Pick<Midia, 'nota_media' | 'nota_fonte' | 'origem_nota'>;

/**
 * O que o formulário de Avaliação manda em POST /avaliacoes (mais `id_midia`) e em
 * PUT /avaliacoes/<id>. A API aceita a nota como texto ("7,5"); os apps já mandam número.
 */
export type DadosAvaliacao = Required<Pick<Esquemas['CorpoNovaAvaliacao'], 'titulo_avaliacao' | 'texto_avaliacao'>> & {
  nota: number;
};

/** Uma plataforma de Integração e a conta do Usuário nela (GET /integracoes). */
export type Integracao = Esquemas['Integracao'];

/** Contagens de uma importação por Integração (prévia, confirmação, última sincronização). */
export type ResultadoImportacao = Esquemas['ResultadoImportacao'];

/** Um item que não casou com o Catálogo; `origem_id` e `tipo` são null nos resultados antigos. */
export type NaoEncontrado = Esquemas['NaoEncontrado'];


/** Uma Relação de GET /midias/<id>/relacoes, já com o nome visto da Mídia. */
export type RelacaoDaMidia = Esquemas['RelacaoDaMidia'];

/** O código da Relação (`SEQUEL`, `PREQUEL`... e `MESMA_SERIE` nos jogos). */
export type NomeRelacao = RelacaoDaMidia['relacao'];

/** Uma Sugestão de GET /sugestoes: a Mídia e o motivo. */
export type Sugestao = Esquemas['Sugestao'];

/** Por que a obra é Sugestão: a Nota pessoal ou o Favorito de uma semente, ou o Em alta. */
export type MotivoDaSugestao = Esquemas['MotivoDaSugestao'];
