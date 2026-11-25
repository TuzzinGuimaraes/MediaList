import { describe, expect, it } from 'vitest';

import { alvoDoFoco, ID_CABECALHO, type MudancaPendente, vizinhosNaTela } from './focoDaLista';

const mudanca = (campos: Partial<MudancaPendente> = {}): MudancaPendente => ({
  id: 'b',
  antes: 'assistindo',
  vizinhos: ['c', 'a'],
  secao: 'em_progresso',
  anuncio: '',
  ...campos,
});

describe('foco depois de mudar o Status', () => {
  it('vizinhos: o seguinte, depois o anterior', () => {
    expect(vizinhosNaTela(['a', 'b', 'c'], 'b')).toEqual(['c', 'a']);
    expect(vizinhosNaTela(['a', 'b'], 'b')).toEqual(['a']);
    expect(vizinhosNaTela(['a'], 'z')).toEqual([]);
  });

  it('o Item se continua na tela; senão o seguinte, o anterior; senão o separador ou o cabeçalho', () => {
    expect(alvoDoFoco(mudanca(), ['a', 'c', 'b'], [])).toEqual({ item: 'b' });
    expect(alvoDoFoco(mudanca(), ['a', 'c'], [])).toEqual({ item: 'c' });
    expect(alvoDoFoco(mudanca(), ['a'], [])).toEqual({ item: 'a' });
    expect(alvoDoFoco(mudanca(), [], ['em_progresso'])).toEqual({ cabecalho: 'secao-em_progresso' });
    expect(alvoDoFoco(mudanca(), [], ['planejado'])).toEqual({ cabecalho: ID_CABECALHO });
  });
});
