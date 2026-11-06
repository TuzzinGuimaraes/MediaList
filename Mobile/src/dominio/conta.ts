import type { NivelAcesso } from '../api/tipos';

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

const ROTULOS_NIVEL: Record<NivelAcesso, string> = {
  usuario: 'Usuário',
  moderador: 'Moderador',
  admin: 'Administrador',
};

export function rotuloNivelAcesso(nivel: NivelAcesso): string {
  return ROTULOS_NIVEL[nivel] ?? nivel;
}
