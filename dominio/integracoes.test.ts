import {
  chaveDoNaoEncontrado,
  naoEncontradosForaDaAmostra,
  vinculavel,
  resumoDaImportacao,
  SINCRONIZA_SEM_PREVIA,
  temOQueConfirmar,
  textoDePendentes,
} from './integracoes';

describe('resumoDaImportacao', () => {
  it('junta as contagens com plural', () => {
    expect(resumoDaImportacao({ novos: 32, atualizados: 5, total_nao_encontrados: 3 })).toBe(
      '32 novos · 5 atualizados · 3 não encontrados',
    );
  });

  it('usa o singular e tira as partes zeradas', () => {
    expect(resumoDaImportacao({ novos: 1, atualizados: 0, total_nao_encontrados: 1 })).toBe('1 novo · 1 não encontrado');
    expect(resumoDaImportacao({ novos: 0, atualizados: 1, total_nao_encontrados: 0 })).toBe('1 atualizado');
  });

  it('tudo zero é "Nada novo"', () => {
    expect(resumoDaImportacao({ novos: 0, atualizados: 0, total_nao_encontrados: 0 })).toBe('Nada novo');
  });
});

describe('temOQueConfirmar', () => {
  it('só com novos ou atualizados', () => {
    expect(temOQueConfirmar({ novos: 0, atualizados: 0 })).toBe(false);
    expect(temOQueConfirmar({ novos: 0, atualizados: 2 })).toBe(true);
  });
});

describe('naoEncontradosForaDaAmostra', () => {
  it('conta o que a amostra não trouxe', () => {
    const amostra = [{ titulo: 'A', link: null }];
    expect(naoEncontradosForaDaAmostra({ nao_encontrados: amostra, total_nao_encontrados: 4 })).toBe(3);
    expect(naoEncontradosForaDaAmostra({ nao_encontrados: amostra, total_nao_encontrados: 1 })).toBe(0);
  });
});

describe('textoDePendentes', () => {
  it('conta os jogos que ficaram para a sincronização diária', () => {
    expect(textoDePendentes(12)).toBe('12 jogos ainda em processamento');
    expect(textoDePendentes(1)).toBe('1 jogo ainda em processamento');
    expect(textoDePendentes(0)).toBeNull();
  });
});

describe('SINCRONIZA_SEM_PREVIA', () => {
  it('só a Steam sincroniza sem prévia', () => {
    expect([...SINCRONIZA_SEM_PREVIA]).toEqual(['steam']);
  });
});

describe('vinculavel', () => {
  it('só com origem_id e Tipo (os resultados antigos não têm)', () => {
    expect(vinculavel({ titulo: 'A', link: null, origem_id: '9', tipo: 'anime' })).toBe(true);
    expect(vinculavel({ titulo: 'A', link: null })).toBe(false);
    expect(vinculavel({ titulo: 'A', link: null, origem_id: '9', tipo: null })).toBe(false);
  });

  it('a chave distingue o anime e o mangá de mesmo id', () => {
    expect(chaveDoNaoEncontrado({ origem_id: '1', tipo: 'anime' })).not.toBe(
      chaveDoNaoEncontrado({ origem_id: '1', tipo: 'manga' }),
    );
  });
});
