import { formatarData } from './datas';

describe('formatarData', () => {
  it('lê a data no formato que o Flask devolve (RFC 1123)', () => {
    expect(formatarData('Fri, 06 Nov 2026 10:00:00 GMT')).toBe('06/11/2026');
  });

  it('lê ISO 8601, com ou sem hora', () => {
    expect(formatarData('2026-03-01T23:30:00')).toBe('01/03/2026');
    expect(formatarData('2023-09-29')).toBe('29/09/2023');
  });

  it('data ausente ou ilegível vira null', () => {
    expect(formatarData('ontem')).toBeNull();
    expect(formatarData('Fri, 06 Xyz 2026 10:00:00 GMT')).toBeNull();
    expect(formatarData(null)).toBeNull();
    expect(formatarData(undefined)).toBeNull();
    expect(formatarData('')).toBeNull();
  });
});
