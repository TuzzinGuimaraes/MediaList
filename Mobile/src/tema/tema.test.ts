import { resolverTema } from './tema';

describe('resolverTema', () => {
  it('Sistema segue o esquema do aparelho', () => {
    expect(resolverTema('sistema', 'light')).toBe('claro');
    expect(resolverTema('sistema', 'dark')).toBe('escuro');
  });

  it('Sistema sem esquema conhecido fica no Escuro, o padrão', () => {
    expect(resolverTema('sistema', null)).toBe('escuro');
    expect(resolverTema('sistema', 'unspecified')).toBe('escuro');
  });

  it('Escuro e Claro ignoram o aparelho', () => {
    expect(resolverTema('escuro', 'light')).toBe('escuro');
    expect(resolverTema('claro', 'dark')).toBe('claro');
  });
});
