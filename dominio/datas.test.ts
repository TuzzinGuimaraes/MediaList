import { dataDoTexto, diaIso, formatarData, textoDaData } from './datas';

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

describe('data do calendário ⇄ dd/mm/aaaa', () => {
  it('usa o dia do relógio do aparelho, sem deslocar pelo fuso', () => {
    expect(textoDaData(new Date(2026, 0, 5, 23, 59))).toBe('05/01/2026');
    expect(dataDoTexto('05/01/2026')).toEqual(new Date(2026, 0, 5));
  });

  it('vazio ou ilegível não é data', () => {
    expect(dataDoTexto('')).toBeNull();
    expect(dataDoTexto('31/02/2026')).toBeNull();
  });
});

describe('diaIso', () => {
  it('é o dia local do aparelho, com zeros à esquerda', () => {
    expect(diaIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
