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

/** Somas e médias do MySQL (DECIMAL) chegam como texto: "1", "7.00". */
type NumeroOuTexto = number | string;

/** GET /usuario/estatisticas: uma linha por Tipo de mídia presente na Lista pessoal. */
export type RespostaEstatisticas = {
  estatisticas: {
    tipo: string;
    label: string;
    total_midias: NumeroOuTexto;
    concluidos: NumeroOuTexto;
    em_andamento: NumeroOuTexto;
    /** Média das Notas pessoais do Tipo; null se nenhuma foi dada. */
    nota_media: NumeroOuTexto | null;
    favoritos: NumeroOuTexto;
    progresso_total_consumido: NumeroOuTexto;
  }[];
  resumo: {
    total_midias: NumeroOuTexto;
    concluidos: NumeroOuTexto;
    em_andamento: NumeroOuTexto;
    favoritos: NumeroOuTexto;
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

/** A Mídia como vem nas listagens (GET /midias, /midias/trending). */
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

/** O que o card de Mídia lê: serve para qualquer listagem, inclusive populares. */
export type CartaoMidia = Pick<
  MidiaResumo,
  'id_midia' | 'tipo' | 'tipo_label' | 'titulo_original' | 'titulo_portugues' | 'poster_url'
>;

/**
 * Linha de GET /midias/populares (view vw_midias_populares). A rota não serializa
 * DECIMAL: `nota_media` chega como string ("9.10").
 */
export type MidiaPopular = Omit<MidiaResumo, 'nota_media'> & { nota_media: string | null };

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
  /** Nota pessoal; pode chegar como texto (DECIMAL). */
  nota_usuario: NumeroOuTexto | null;
};

export type RespostaLista = { lista: ItemLista[] };

/** Item de GET /noticias (Backend/routes/noticias.py). Datas vêm em RFC 1123 ("Fri, 06 Nov 2026 10:00:00 GMT"). */
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
