// Tipos da API: reexportados de contrato/api.d.ts, gerado do OpenAPI do Backend com
// `make api-tipos` (ADR 0011). Não escrever tipo de resposta à mão aqui; os que não vêm
// da API (CartaoMidia, NotasDaMidia, DadosAvaliacao) são recortes dos gerados.

import type { components } from '../../../contrato/api';
import type { TipoMidia } from '../dominio/estadoConsumo';

type Esquemas = components['schemas'];

export type { TipoMidia };

// Erro

/** Envelope de todo erro da API: `{erro, codigo, detalhes?}`. */
export type Erro = Esquemas['Erro'];
export type CodigoErro = Esquemas['CodigoErro'];

// Sessão e Usuário

export type NivelAcesso = Esquemas['Permissoes']['nivel_acesso'];
/** `usuario` da resposta de POST /auth/login. */
export type UsuarioSessao = Esquemas['UsuarioDaSessao'];
/** POST /auth/login. `refresh_token` é null quando o banco não gravou o refresh (ADR 0006). */
export type RespostaLogin = Esquemas['RespostaLogin'];
export type RespostaRefresh = Esquemas['RespostaRefresh'];
/** O que o formulário de registro do app manda em POST /auth/registro. */
export type DadosRegistro = Pick<Esquemas['CorpoRegistro'], 'nome_completo' | 'email' | 'senha'>;
export type RespostaRegistro = Esquemas['UsuarioCriado'];
export type RespostaMe = Esquemas['RespostaMe'];
export type RespostaPermissoes = Esquemas['RespostaPermissoes'];
/** GET /usuario/estatisticas: uma linha por Tipo de mídia presente na Lista pessoal. */
export type RespostaEstatisticas = Esquemas['RespostaEstatisticas'];

// Mídias

/** A Mídia das listagens (GET /midias, /midias/trending): os campos de todos os Tipos. */
export type Midia = Esquemas['Midia'];
/** GET /midias/<id>: a Mídia com as Atualizações de mídia recentes. */
export type MidiaDetalhe = Esquemas['MidiaDetalhe'];
/** Linha de GET /midias/populares (view vw_midias_populares). */
export type MidiaPopular = Esquemas['MidiaPopular'];
export type RespostaTrending = Esquemas['RespostaTrending'];
export type RespostaPopulares = Esquemas['RespostaPopulares'];
/** Uma página de GET /midias: `total` conta todas as páginas. */
export type PaginaMidias = Esquemas['PaginaMidia'];
/** GET /midias/<id>/distribuicao: quantos Usuários têm a Mídia em cada Rótulo de estado. */
export type RespostaDistribuicao = Esquemas['RespostaDistribuicao'];
export type Genero = Esquemas['Genero'];
export type RespostaGeneros = Esquemas['RespostaGeneros'];
export type OrigemNota = NonNullable<Midia['origem_nota']>;

/**
 * Valores de `ordem` de GET /midias que o app usa. `popularidade` fica de fora: é a mesma
 * chave de `mais_adicionados` (total_usuarios) no Backend.
 */
export type OrdemCatalogo = Exclude<NonNullable<Esquemas['ConsultaMidias']['ordem']>, 'popularidade'>;

/** As notas de uma Mídia (CONTEXT.md: Nota média, Nota da fonte), em qualquer listagem. */
export type NotasDaMidia = Pick<Midia, 'nota_media' | 'nota_fonte' | 'origem_nota'>;

/** O que o card de Mídia lê: serve para qualquer listagem (Mídia, populares, Item de lista). */
export type CartaoMidia = Pick<Midia, 'id_midia' | 'tipo' | 'titulo_original' | 'titulo_portugues' | 'poster_url'> &
  NotasDaMidia;

// Avaliações

/** Item de GET /avaliacoes/<id_midia>. */
export type Avaliacao = Esquemas['AvaliacaoDaMidia'];
/** Uma página de GET /avaliacoes/<id_midia>. */
export type PaginaAvaliacoes = Esquemas['PaginaAvaliacaoDaMidia'];
export type AvaliacaoCriada = Esquemas['AvaliacaoCriada'];
export type AvaliacaoEditada = Esquemas['AvaliacaoEditada'];
/**
 * O que o formulário de Avaliação manda em POST /avaliacoes (mais `id_midia`) e em
 * PUT /avaliacoes/<id>. A API aceita a nota como texto ("7,5"); o app já manda número.
 */
export type DadosAvaliacao = Required<Pick<Esquemas['CorpoNovaAvaliacao'], 'titulo_avaliacao' | 'texto_avaliacao'>> & {
  nota: number;
};

// Lista pessoal

/** Item de GET /lista: a Mídia (parte dos campos) mais os campos do Item de lista. */
export type ItemLista = Esquemas['ItemLista'];
export type RespostaLista = Esquemas['RespostaLista'];

// Notícias e Notificações

export type Noticia = Esquemas['Noticia'];
/** Uma página de GET /noticias. */
export type PaginaNoticias = Esquemas['PaginaNoticia'];
/** Item de GET /notificacoes: a entrega de uma Atualização de mídia. */
export type Notificacao = Esquemas['Notificacao'];
export type RespostaNotificacoes = Esquemas['RespostaNotificacoes'];
