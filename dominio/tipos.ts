// Tipos da API que o domínio lê, recortados de contrato/api.d.ts (gerado com `make api-tipos`,
// ADR 0011). Não escrever tipo de resposta à mão aqui.

import type { components } from '../contrato/api';

type Esquemas = components['schemas'];

export type NivelAcesso = Esquemas['Permissoes']['nivel_acesso'];

/** O `codigo` do envelope de erro da API (ADR 0011). */
export type CodigoErro = Esquemas['CodigoErro'];

/** A Mídia das listagens (GET /midias, /midias/trending): os campos de todos os Tipos. */
export type Midia = Esquemas['Midia'];

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
