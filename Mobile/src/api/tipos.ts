// Tipos escritos à mão, só para os endpoints que o app usa (Backend/routes/).

export type NivelAcesso = 'admin' | 'moderador' | 'usuario';

/** `usuario` da resposta de POST /auth/login. */
export type UsuarioSessao = {
  /** Ex.: "USR-20261106-01003". */
  id: string;
  nome: string;
  email: string;
  nivel_acesso: NivelAcesso;
  grupos: string | null;
  /** O MySQL devolve 0/1. */
  permissoes: {
    pode_criar: boolean | number;
    pode_editar: boolean | number;
    pode_deletar: boolean | number;
    pode_moderar: boolean | number;
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

/** GET /usuario/permissoes. */
export type RespostaPermissoes = {
  permissoes: {
    nivel_acesso: NivelAcesso;
    grupos: string | null;
  };
};


export type TipoMidia = 'anime' | 'manga' | 'jogo';

/**
 * O que todo card de Mídia precisa. Vem de /midias/trending, /midias e também de
 * /midias/populares, cuja view traz só um subconjunto dos campos.
 */
export type MidiaResumo = {
  /** Ex.: "MID-ANM-2026-20053". */
  id_midia: string;
  tipo: TipoMidia;
  /** "Anime", "Mangá", "Jogo". */
  tipo_label: string;
  titulo_original: string;
  titulo_portugues: string | null;
  poster_url: string | null;
  /** Pode vir preenchida pela Importação mesmo sem Avaliações: ver `notaMedia`. */
  nota_media: number | null;
  total_usuarios: number;
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
  total_avaliacoes: number;
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
};

/** GET /midias/<id>/distribuicao: quantos Usuários têm a Mídia em cada Rótulo de estado. */
export type RespostaDistribuicao = {
  distribuicao: { status_consumo: string; total: number }[];
};

/** Cada item de GET /avaliacoes/<id_midia>. Só o que o detalhe lê por enquanto. */
export type Avaliacao = {
  id_avaliacao: string;
  id_usuario: string;
  /** DECIMAL(3,2) de 0 a 10. */
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
};

export type RespostaLista = { lista: ItemLista[] };
