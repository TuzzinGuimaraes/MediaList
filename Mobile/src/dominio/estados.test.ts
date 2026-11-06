import { contarPorEstado, estadoDoRotulo } from './estados';

describe('estadoDoRotulo', () => {
  it('traduz o Rótulo de estado de cada Tipo para o Estado de consumo', () => {
    expect(estadoDoRotulo('assistindo')).toBe('Em progresso');
    expect(estadoDoRotulo('lendo')).toBe('Em progresso');
    expect(estadoDoRotulo('jogando')).toBe('Em progresso');
    expect(estadoDoRotulo('na_fila')).toBe('Planejado');
    expect(estadoDoRotulo('lido')).toBe('Concluído');
    expect(estadoDoRotulo('zerado')).toBe('Concluído');
    expect(estadoDoRotulo('platinado')).toBe('Platinado');
    expect(estadoDoRotulo('pausado')).toBe('Pausado');
    expect(estadoDoRotulo('abandonado')).toBe('Abandonado');
  });

  it('Rótulo desconhecido passa como veio', () => {
    expect(estadoDoRotulo('xyz')).toBe('xyz');
  });
});

describe('contarPorEstado', () => {
  it('soma Rótulos do mesmo Estado e conta os platinados também como concluídos', () => {
    expect(
      contarPorEstado([
        { status_consumo: 'zerado', total: 2 },
        { status_consumo: 'platinado', total: 1 },
        { status_consumo: 'jogando', total: 4 },
        { status_consumo: 'na_fila', total: 3 },
      ]),
    ).toEqual([
      { estado: 'Planejado', total: 3 },
      { estado: 'Em progresso', total: 4 },
      { estado: 'Concluído', total: 3 },
      { estado: 'Platinado', total: 1 },
    ]);
  });
});
