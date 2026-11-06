import { validarAvaliacao } from './avaliacao';

describe('validarAvaliacao', () => {
  const valida = { nota: '8.5', titulo: 'Bonito', texto: 'Gostei muito.' };

  it('aceita nota, título e texto e devolve o payload da API', () => {
    expect(validarAvaliacao(valida)).toEqual({
      ok: true,
      dados: { nota: 8.5, titulo_avaliacao: 'Bonito', texto_avaliacao: 'Gostei muito.' },
    });
  });

  it('aceita vírgula como separador decimal', () => {
    expect(validarAvaliacao({ ...valida, nota: '7,25' })).toMatchObject({ ok: true, dados: { nota: 7.25 } });
  });

  it('título e texto são opcionais: vazios vão como null', () => {
    expect(validarAvaliacao({ nota: '6', titulo: '  ', texto: '' })).toEqual({
      ok: true,
      dados: { nota: 6, titulo_avaliacao: null, texto_avaliacao: null },
    });
  });

  it('exige a nota', () => {
    expect(validarAvaliacao({ ...valida, nota: ' ' })).toEqual({ ok: false, erro: 'Informe a nota.' });
    expect(validarAvaliacao({ ...valida, nota: 'nove' })).toEqual({ ok: false, erro: 'Informe a nota.' });
  });

  it('recusa nota fora da faixa que o banco grava (maior que 0, até 9,99)', () => {
    const erro = { ok: false, erro: 'A nota vai de 0,01 a 9,99.' };
    expect(validarAvaliacao({ ...valida, nota: '0' })).toEqual(erro);
    expect(validarAvaliacao({ ...valida, nota: '-1' })).toEqual(erro);
    expect(validarAvaliacao({ ...valida, nota: '10' })).toEqual(erro);
    expect(validarAvaliacao({ ...valida, nota: '9.99' })).toMatchObject({ ok: true });
    expect(validarAvaliacao({ ...valida, nota: '0.01' })).toMatchObject({ ok: true });
  });

  it('recusa título com mais de 200 caracteres', () => {
    expect(validarAvaliacao({ ...valida, titulo: 'a'.repeat(201) })).toEqual({
      ok: false,
      erro: 'O título tem no máximo 200 caracteres.',
    });
  });
});
