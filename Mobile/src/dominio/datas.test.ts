import { formatarData } from './datas';

describe('formatarData', () => {
  it('lê a data no formato que o Flask devolve (RFC 1123)', () => {
    expect(formatarData('Fri, 06 Nov 2026 10:00:00 GMT')).toBe('06/11/2026');
  });

  it('lê ISO 8601', () => {
    expect(formatarData('2026-03-01T23:30:00')).toBe('01/03/2026');
  });

  it('data ilegível vira vazio', () => {
    expect(formatarData('ontem')).toBe('');
  });
});
