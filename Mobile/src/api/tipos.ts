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
