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
    expect(validarAvaliacao({ ...valida, nota: '7,5' })).toMatchObject({ ok: true, dados: { nota: 7.5 } });
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

  it('aceita de 0 a 10 com uma casa decimal', () => {
    expect(validarAvaliacao({ ...valida, nota: '0' })).toMatchObject({ ok: true, dados: { nota: 0 } });
    expect(validarAvaliacao({ ...valida, nota: '10' })).toMatchObject({ ok: true, dados: { nota: 10 } });
    expect(validarAvaliacao({ ...valida, nota: '9,9' })).toMatchObject({ ok: true, dados: { nota: 9.9 } });
  });

  it('recusa nota fora da escala, sem arredondar', () => {
    const erro = { ok: false, erro: 'A nota vai de 0 a 10, com no máximo uma casa decimal.' };
    expect(validarAvaliacao({ ...valida, nota: '8,55' })).toEqual(erro);
    expect(validarAvaliacao({ ...valida, nota: '9.99' })).toEqual(erro);
    expect(validarAvaliacao({ ...valida, nota: '-1' })).toEqual(erro);
    expect(validarAvaliacao({ ...valida, nota: '10.1' })).toEqual(erro);
    expect(validarAvaliacao({ ...valida, nota: '1e1' })).toEqual(erro);
  });

  it('recusa título com mais de 200 caracteres', () => {
    expect(validarAvaliacao({ ...valida, titulo: 'a'.repeat(201) })).toEqual({
      ok: false,
      erro: 'O título tem no máximo 200 caracteres.',
    });
  });
});
