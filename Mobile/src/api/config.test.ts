import { resolverUrlApi } from './config';

describe('resolverUrlApi', () => {
  it('em desenvolvimento, usa o host do Metro na porta 5000 com /api', () => {
    expect(resolverUrlApi(undefined, '192.168.0.12:8081', true)).toBe('http://192.168.0.12:5000/api');
  });

  it('EXPO_PUBLIC_API_URL sobrescreve a descoberta', () => {
    expect(resolverUrlApi('https://api.medialist.dev/api/', '192.168.0.12:8081', true)).toBe(
      'https://api.medialist.dev/api',
    );
  });

  it('sem host do Metro, cai em localhost', () => {
    expect(resolverUrlApi(undefined, undefined, true)).toBe('http://localhost:5000/api');
  });

  it('em produção, exige EXPO_PUBLIC_API_URL', () => {
    expect(() => resolverUrlApi(undefined, '192.168.0.12:8081', false)).toThrow(
      'EXPO_PUBLIC_API_URL',
    );
  });
});
