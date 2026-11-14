import { contarPorEstado, estadoDe, eTerminal, mediaNotasPessoais, nomeDoRotulo, rotulosDoTipo, somarPorEstado } from './estadoConsumo';

describe('estadoDe', () => {
  it('traduz o Rótulo de estado de cada Tipo para o Estado de consumo (tabela do CONTEXT.md)', () => {
    expect(estadoDe('planejado', 'anime')).toBe('planejado');
    expect(estadoDe('assistindo', 'anime')).toBe('em_progresso');
    expect(estadoDe('completo', 'anime')).toBe('concluido');
    expect(estadoDe('lendo', 'manga')).toBe('em_progresso');
    expect(estadoDe('lido', 'manga')).toBe('concluido');
    expect(estadoDe('na_fila', 'jogo')).toBe('planejado');
    expect(estadoDe('jogando', 'jogo')).toBe('em_progresso');
    expect(estadoDe('pausado', 'jogo')).toBe('pausado');
    expect(estadoDe('abandonado', 'manga')).toBe('abandonado');
    expect(estadoDe('zerado', 'jogo')).toBe('concluido');
    expect(estadoDe('platinado', 'jogo')).toBe('platinado');
  });

  it('um rótulo de outro Tipo não vale: anime nunca está platinado nem jogando', () => {
    expect(estadoDe('platinado', 'anime')).toBeNull();
    expect(estadoDe('jogando', 'anime')).toBeNull();
    expect(estadoDe('lido', 'jogo')).toBeNull();
  });

  it('rótulo desconhecido ou ausente não tem estado', () => {
    expect(estadoDe('xyz', 'anime')).toBeNull();
    expect(estadoDe(null, 'anime')).toBeNull();
  });
});

describe('rotulosDoTipo', () => {
  it('só jogo oferece platinado', () => {
    expect(rotulosDoTipo('anime')).toEqual(['planejado', 'assistindo', 'pausado', 'abandonado', 'completo']);
    expect(rotulosDoTipo('manga')).toEqual(['planejado', 'lendo', 'pausado', 'abandonado', 'lido']);
    expect(rotulosDoTipo('jogo')).toEqual(['na_fila', 'jogando', 'pausado', 'abandonado', 'zerado', 'platinado']);
  });
});

describe('contarPorEstado', () => {
  it('conta por Estado de consumo, com Platinado incluído em Concluído', () => {
    const contagem = contarPorEstado([
      { tipo: 'anime', status_consumo: 'completo' },
      { tipo: 'manga', status_consumo: 'lido' },
      { tipo: 'jogo', status_consumo: 'zerado' },
      { tipo: 'jogo', status_consumo: 'platinado' },
      { tipo: 'jogo', status_consumo: 'platinado' },
      { tipo: 'anime', status_consumo: 'assistindo' },
      { tipo: 'jogo', status_consumo: 'na_fila' },
      { tipo: 'manga', status_consumo: 'pausado' },
    ]);

    expect(contagem).toEqual({
      planejado: 1,
      em_progresso: 1,
      pausado: 1,
      abandonado: 0,
      concluido: 5,
      platinado: 2,
    });
  });

  it('ignora rótulos que não valem para o Tipo', () => {
    expect(contarPorEstado([{ tipo: 'anime', status_consumo: 'platinado' }]).concluido).toBe(0);
  });
});

describe('mediaNotasPessoais', () => {
  it('é a média das Notas pessoais dadas, ignorando itens sem nota', () => {
    expect(mediaNotasPessoais([{ nota_usuario: 8 }, { nota_usuario: 7 }, { nota_usuario: null }])).toBe(7.5);
  });

  it('sem nenhuma nota, não há média', () => {
    expect(mediaNotasPessoais([{ nota_usuario: null }])).toBeNull();
    expect(mediaNotasPessoais([])).toBeNull();
  });
});

describe('nomeDoRotulo', () => {
  it('dá o nome do Estado de consumo para o rótulo do Tipo', () => {
    expect(nomeDoRotulo('lendo', 'manga')).toBe('Em progresso');
    expect(nomeDoRotulo('zerado', 'jogo')).toBe('Concluído');
  });

  it('rótulo desconhecido ou de outro Tipo passa como veio', () => {
    expect(nomeDoRotulo('xyz', 'anime')).toBe('xyz');
    expect(nomeDoRotulo('platinado', 'anime')).toBe('platinado');
  });
});

describe('somarPorEstado', () => {
  it('soma linhas agregadas por Estado e conta platinados também como concluídos', () => {
    expect(
      somarPorEstado(
        [
          { status_consumo: 'zerado', total: 2 },
          { status_consumo: 'platinado', total: 1 },
          { status_consumo: 'jogando', total: 4 },
          { status_consumo: 'na_fila', total: 3 },
        ],
        'jogo',
      ),
    ).toEqual([
      { estado: 'planejado', nome: 'Planejado', total: 3 },
      { estado: 'em_progresso', nome: 'Em progresso', total: 4 },
      { estado: 'concluido', nome: 'Concluído', total: 3 },
      { estado: 'platinado', nome: 'Platinado', total: 1 },
    ]);
  });
});

describe('eTerminal', () => {
  it('Concluído e Platinado terminaram; os outros Estados e o desconhecido, não', () => {
    expect(eTerminal('concluido')).toBe(true);
    expect(eTerminal('platinado')).toBe(true);
    expect(eTerminal('em_progresso')).toBe(false);
    expect(eTerminal('abandonado')).toBe(false);
    expect(eTerminal(null)).toBe(false);
  });
});
