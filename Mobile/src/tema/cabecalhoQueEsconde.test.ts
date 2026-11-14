import { deslocarCabecalho } from './cabecalhoQueEsconde';

const ALTURA = 60;

describe('deslocarCabecalho', () => {
  it('rolar para baixo esconde o cabeçalho na mesma medida, até a altura dele', () => {
    expect(deslocarCabecalho({ atual: 0, y: 20, yAnterior: 0, altura: ALTURA })).toBe(20);
    expect(deslocarCabecalho({ atual: 50, y: 300, yAnterior: 280, altura: ALTURA })).toBe(60);
  });

  it('rolar para cima traz o cabeçalho de volta, sem passar da posição aberta', () => {
    expect(deslocarCabecalho({ atual: 60, y: 480, yAnterior: 500, altura: ALTURA })).toBe(40);
    expect(deslocarCabecalho({ atual: 10, y: 400, yAnterior: 500, altura: ALTURA })).toBe(0);
  });

  it('no topo (ou no repique acima dele) o cabeçalho fica inteiro', () => {
    expect(deslocarCabecalho({ atual: 60, y: 0, yAnterior: 30, altura: ALTURA })).toBe(0);
    expect(deslocarCabecalho({ atual: 60, y: -15, yAnterior: 5, altura: ALTURA })).toBe(0);
  });
});
