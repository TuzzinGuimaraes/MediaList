import type { CodigoErro, NivelAcesso } from './tipos';

// Validação local dos formulários de conta. O backend continua autoritativo:
// estas funções só evitam uma ida ao servidor com dados obviamente errados.

export function validarLogin({ email, senha }: { email: string; senha: string }): string | null {
  if (!email.trim() || !senha) return 'Informe email e senha.';
  return null;
}

export type FormularioRegistro = {
  nome: string;
  email: string;
  senha: string;
  confirmacao: string;
};

export const SENHA_MINIMA = 6;

export function validarRegistro(f: FormularioRegistro): string | null {
  if (!f.nome.trim()) return 'Informe seu nome.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return 'Email inválido.';
  if (f.senha.length < SENHA_MINIMA) {
    return `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`;
  }
  if (f.senha !== f.confirmacao) return 'As senhas não conferem.';
  return null;
}

/**
 * O 403 de quem entrou com uma Senha temporária e ainda não a trocou (CONTEXT.md): em
 * qualquer chamada, o cliente leva à tela "Defina sua nova senha".
 */
export const TROCA_DE_SENHA_OBRIGATORIA = 'troca_de_senha_obrigatoria' satisfies CodigoErro;

export type FormularioNovaSenha = {
  senhaAtual: string;
  novaSenha: string;
  confirmacao: string;
};

/** A troca de senha: a mesma regra de tamanho do registro, e a nova diferente da atual. */
export function validarNovaSenha(f: FormularioNovaSenha): string | null {
  if (!f.senhaAtual) return 'Informe a senha atual.';
  if (f.novaSenha.length < SENHA_MINIMA) {
    return `A nova senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`;
  }
  if (f.novaSenha === f.senhaAtual) return 'A nova senha precisa ser diferente da atual.';
  if (f.novaSenha !== f.confirmacao) return 'As senhas não conferem.';
  return null;
}

const ROTULOS_NIVEL: Record<NivelAcesso, string> = {
  usuario: 'Usuário',
  admin: 'Administrador',
};

export function rotuloNivelAcesso(nivel: NivelAcesso): string {
  return ROTULOS_NIVEL[nivel] ?? nivel;
}

/** A inicial que o avatar mostra: a primeira letra do nome, maiúscula; "?" sem nome. */
export function inicialDoNome(nome: string): string {
  return nome.trim()[0]?.toUpperCase() ?? '?';
}
