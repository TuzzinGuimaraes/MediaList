import { rotuloNivelAcesso, validarLogin, validarRegistro } from './conta';

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

describe('rotuloNivelAcesso', () => {
  it('traduz o Nível de acesso para a interface', () => {
    expect(rotuloNivelAcesso('usuario')).toBe('Usuário');
    expect(rotuloNivelAcesso('moderador')).toBe('Moderador');
    expect(rotuloNivelAcesso('admin')).toBe('Administrador');
  });
});
