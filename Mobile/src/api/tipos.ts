// Tipos escritos à mão, só para os endpoints que o app usa (Backend/routes/).

import type { TipoMidia } from '../dominio/estadoConsumo';

export type { TipoMidia };

export type NivelAcesso = 'admin' | 'moderador' | 'usuario';

/** `usuario` da resposta de POST /auth/login. */
export type UsuarioSessao = {
  /** uuid. */
  id: string;
  nome: string;
  email: string;
  nivel_acesso: NivelAcesso;
  grupos: string | null;
  /** 0 ou 1: a rota manda o MAX(CASE ... THEN 1 ELSE 0) dos Grupos do Usuário. */
  permissoes: {
    pode_criar: number;
    pode_editar: number;
    pode_deletar: number;
    pode_moderar: number;
  };
};

/** POST /auth/login. `refresh_token` é null quando o banco não tem a tabela (ADR 0006). */
export type RespostaLogin = {
  token: string;
  access_token: string;
  refresh_token: string | null;
  usuario: UsuarioSessao;
};

/** POST /auth/refresh. */
export type RespostaRefresh = {
  access_token: string;
  refresh_token: string;
};

/** POST /auth/registro. */
export type DadosRegistro = {
  nome_completo: string;
  email: string;
  senha: string;
};

/** GET /auth/me. */
export type RespostaMe = {
  usuario: {
    id_usuario: string;
    nome_completo: string;
    email: string;
    foto_perfil: string | null;
  };
};

/** GET /usuario/estatisticas: uma linha por Tipo de mídia presente na Lista pessoal. */
export type RespostaEstatisticas = {
  estatisticas: {
    tipo: string;
    label: string;
    total_midias: number;
    concluidos: number;
    em_andamento: number;
    /** Média das Notas pessoais do Tipo; null se nenhuma foi dada. */
    nota_media: number | null;
    favoritos: number;
    progresso_total_consumido: number;
  }[];
  resumo: {
    total_midias: number;
    concluidos: number;
    em_andamento: number;
    favoritos: number;
  };
};

/** GET /usuario/permissoes. */
export type RespostaPermissoes = {
  permissoes: {
    nivel_acesso: NivelAcesso;
    grupos: string | null;
  };
};



/** Fonte da Nota da fonte, derivada do id externo da Mídia. */
export type OrigemNota = 'AniList' | 'RAWG';

/**
 * As notas de uma Mídia. `nota_media` é a média das Avaliações, null sem elas;
 * `nota_fonte` é a do AniList/RAWG, gravada pela Importação. As duas vêm como número.
 */
export type NotasDaMidia = {
  nota_media: number | null;
  nota_fonte?: number | null;
  origem_nota?: OrigemNota | null;
};

/** A Mídia como vem nas listagens (GET /midias, /midias/trending). */
export type MidiaResumo = NotasDaMidia & {
  /** uuid. */
  id_midia: string;
  tipo: TipoMidia;
  /** "Anime", "Mangá", "Jogo". */
  tipo_label: string;
  titulo_original: string;
  titulo_portugues: string | null;
  poster_url: string | null;
  nota_media: number | null;
  total_usuarios: number;
};

/** O que o card de Mídia lê: serve para qualquer listagem, inclusive populares. */
export type CartaoMidia = Pick<
  MidiaResumo,
  'id_midia' | 'tipo' | 'tipo_label' | 'titulo_original' | 'titulo_portugues' | 'poster_url'
> &
  NotasDaMidia;

/** Linha de GET /midias/populares (view vw_midias_populares); não traz `total_avaliacoes`. */
export type MidiaPopular = MidiaResumo & {
  /** "Aventura, Drama" ou null. */
  generos: string | null;
};

/** GET /midias/trending e GET /midias/populares. */
export type RespostaMidias<M = MidiaResumo> = { midias: M[] };

/** GET /midias/<id> e cada item de GET /midias/trending: a Mídia com os campos de todos os Tipos. */
export type Midia = MidiaResumo & {
  titulo_ingles: string | null;
  sinopse: string | null;
  /** "2023-09-29". */
  data_lancamento: string | null;
  banner_url: string | null;
  /** null quando a Mídia não tem Avaliações (como `nota_media`). */
  total_avaliacoes: number | null;
  /** "Aventura, Drama" ou null; `generos_lista` é a mesma coisa já separada. */
  generos: string | null;
  generos_lista: string[];
  // anime
  numero_episodios: number | null;
  status_anime: string | null;
  estudio: string | null;
  // manga
  numero_capitulos: number | null;
  numero_volumes: number | null;
  status_manga: string | null;
  autor: string | null;
  demografia: string | null;
  // jogo
  /** "PC, Switch, PS4". */
  plataformas: string | null;
  status_jogo: string | null;
  desenvolvedor: string | null;
  publicadora: string | null;
  /** Itens desta Mídia em Concluído ou Platinado (ordem `mais_concluidos`). */
  total_concluidos: number;
};

/** GET /midias/<id>/distribuicao: quantos Usuários têm a Mídia em cada Rótulo de estado. */
export type RespostaDistribuicao = {
  distribuicao: { status_consumo: string; total: number }[];
};

/** Cada item de GET /avaliacoes/<id_midia>. Só o que o detalhe lê por enquanto. */
export type Avaliacao = {
  id_avaliacao: string;
  id_usuario: string;
  /** De 0 a 10, uma casa. */
  nota: number;
};

export type RespostaAvaliacoes = { avaliacoes: Avaliacao[] };

/** Cada item de GET /lista: a Mídia mais os campos do Item de lista. */
export type ItemLista = Midia & {
  id_lista: string;
  /** Rótulo de estado, ex.: "assistindo", "zerado". */
  status_consumo: string;
  progresso_atual: number | null;
  progresso_total: number | null;
  /** Nota pessoal, de 0 a 10 com uma casa. */
  nota_usuario: number | null;
  favorito?: boolean;
  privado?: boolean;
  /** "2026-10-01" ou null. */
  data_inicio?: string | null;
  data_conclusao?: string | null;
  /** Recontagem. */
  total_rewatches?: number | null;
  comentario?: string | null;
  /** ISO 8601 ("2026-11-06T10:00:00+00:00"): Ordem "adicionado/atualizado recentemente". */
  data_adicao?: string;
  data_atualizacao?: string;
};

export type RespostaLista = { lista: ItemLista[] };

/** Item de GET /noticias (Backend/routes/noticias.py). Datas vêm em ISO 8601 ("2026-11-06T10:00:00+00:00"). */
export type Noticia = {
  titulo: string;
  conteudo: string;
  autor: string;
  categoria: string;
  tags: string[];
  imagem_url: string | null;
  data_publicacao: string;
  visualizacoes: number;
};

export type RespostaNoticias = { noticias: Noticia[] };

/** Item de GET /notificacoes: a entrega de uma Atualização de mídia (Backend/routes/midias.py). */
export type Notificacao = {
  id_usuario: string;
  id_midia: string;
  tipo_midia: string;
  tipo: string;
  titulo: string;
  midia_nome: string;
  mensagem: string;
  lida: boolean;
  data_criacao: string;
};

export type RespostaNotificacoes = { notificacoes: Notificacao[] };


/** Valores de `ordem` de GET /midias que o app usa (ORDENS em Backend/repositories/catalogo.py). */
export type OrdemCatalogo = 'nota_media' | 'titulo' | 'data_lancamento' | 'mais_adicionados' | 'mais_concluidos';

/**
 * Uma página de GET /midias. A API não manda total: uma página com menos de
 * `por_pagina` Mídias é a última.
 */
export type PaginaMidias = {
  midias: MidiaResumo[];
  pagina: number;
  por_pagina: number;
  tipo: TipoMidia | null;
};

/** Item de GET /generos?tipo=. `aplicavel_a` é o text[] do banco, como lista. */
export type Genero = {
  id_genero: number;
  nome_genero: string;
  descricao: string | null;
  aplicavel_a: TipoMidia[];
};

export type RespostaGeneros = { generos: Genero[] };

/** Campos completos de cada item de GET /avaliacoes/<id_midia> (conferido contra o backend local). */
export type AvaliacaoCompleta = Avaliacao & {
  id_midia: string;
  titulo_avaliacao: string | null;
  texto_avaliacao: string | null;
  /** "2026-11-06T15:07:43". */
  data_avaliacao: string;
  data_edicao: string | null;
  nome_completo: string;
  foto_perfil: string | null;
};

/** Corpo de POST /avaliacoes (com `id_midia`) e de PUT /avaliacoes/<id_avaliacao>. */
export type DadosAvaliacao = {
  nota: number;
  titulo_avaliacao: string | null;
  texto_avaliacao: string | null;
};
