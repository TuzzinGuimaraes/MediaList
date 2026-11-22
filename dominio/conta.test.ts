import {
  inicialDoNome,
  rotuloNivelAcesso,
  TROCA_DE_SENHA_OBRIGATORIA,
  validarLogin,
  validarNovaSenha,
  validarRegistro,
} from './conta';

describe('validarLogin', () => {
  it('exige email e senha', () => {
    expect(validarLogin({ email: ' ', senha: 'x' })).toBe('Informe email e senha.');
    expect(validarLogin({ email: 'a@b.com', senha: '' })).toBe('Informe email e senha.');
    expect(validarLogin({ email: 'a@b.com', senha: 'x' })).toBeNull();
  });
});

describe('validarRegistro', () => {
  const valido = { nome: 'Ana', email: 'ana@exemplo.com', senha: 'segredo1', confirmacao: 'segredo1' };

  it('aceita um cadastro completo', () => {
    expect(validarRegistro(valido)).toBeNull();
  });

  it('recusa nome vazio, email sem @, senha curta e confirmação diferente', () => {
    expect(validarRegistro({ ...valido, nome: '  ' })).toBe('Informe seu nome.');
    expect(validarRegistro({ ...valido, email: 'ana.exemplo.com' })).toBe('Email inválido.');
    expect(validarRegistro({ ...valido, senha: '12345', confirmacao: '12345' })).toBe(
      'A senha precisa ter pelo menos 6 caracteres.',
    );
    expect(validarRegistro({ ...valido, confirmacao: 'outra' })).toBe('As senhas não conferem.');
  });
});

describe('validarNovaSenha', () => {
  const valida = { senhaAtual: 'temp2345', novaSenha: 'segredo1', confirmacao: 'segredo1' };

  it('aceita a troca completa', () => {
    expect(validarNovaSenha(valida)).toBeNull();
  });

  it('recusa sem a atual, nova curta, nova igual à atual e confirmação diferente', () => {
    expect(validarNovaSenha({ ...valida, senhaAtual: '' })).toBe('Informe a senha atual.');
    expect(validarNovaSenha({ ...valida, novaSenha: '12345', confirmacao: '12345' })).toBe(
      'A nova senha precisa ter pelo menos 6 caracteres.',
    );
    expect(validarNovaSenha({ ...valida, novaSenha: 'temp2345', confirmacao: 'temp2345' })).toBe(
      'A nova senha precisa ser diferente da atual.',
    );
    expect(validarNovaSenha({ ...valida, confirmacao: 'outra' })).toBe('As senhas não conferem.');
  });
});

describe('TROCA_DE_SENHA_OBRIGATORIA', () => {
  it('é o código do 403 de quem ainda não trocou a Senha temporária', () => {
    expect(TROCA_DE_SENHA_OBRIGATORIA).toBe('troca_de_senha_obrigatoria');
  });
});

describe('rotuloNivelAcesso', () => {
  it('traduz o Nível de acesso para a interface', () => {
    expect(rotuloNivelAcesso('usuario')).toBe('Usuário');
    expect(rotuloNivelAcesso('admin')).toBe('Administrador');
  });
});

describe('inicialDoNome', () => {
  it('é a primeira letra do nome, maiúscula, ignorando espaços', () => {
    expect(inicialDoNome('  ana Souza')).toBe('A');
    expect(inicialDoNome('Élio')).toBe('É');
  });

  it('nome vazio vira "?"', () => {
    expect(inicialDoNome('   ')).toBe('?');
  });
});
