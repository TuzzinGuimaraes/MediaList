import {
  descricaoAcessivel,
  eRara,
  nomeDaConquista,
  sugereMarcarPlatinado,
  TEXTOS_DAS_CONQUISTAS,
  textoDaRaridade,
  textoDoResumo,
} from './conquistas';
import type { ConquistaDoItem } from './tipos';

function conquista(dados: Partial<ConquistaDoItem> = {}): ConquistaDoItem {
  return {
    codigo: 'A',
    nome: 'O Louco',
    descricao: 'Comece a jornada.',
    icone: null,
    oculta: false,
    raridade: 50,
    obtida: false,
    obtida_em: null,
    destacada: false,
    ...dados,
  };
}

describe('textoDoResumo', () => {
  it('mostra obtidas do total', () => {
    expect(textoDoResumo({ obtidas: 34, total: 50 })).toBe('34/50 conquistas');
  });

  it('mostra zero quando há conquistas e nenhuma obtida', () => {
    expect(textoDoResumo({ obtidas: 0, total: 50 })).toBe('0/50 conquistas');
  });

  it('jogo sem dado não mostra nada', () => {
    expect(textoDoResumo(null)).toBeNull();
    expect(textoDoResumo(undefined)).toBeNull();
    expect(textoDoResumo({ obtidas: 0, total: 0 })).toBeNull();
  });
});

describe('raridade', () => {
  it('é rara abaixo de 10% dos jogadores', () => {
    expect(eRara(9.99)).toBe(true);
    expect(eRara(0)).toBe(true);
    expect(eRara(10)).toBe(false);
    expect(eRara(null)).toBe(false);
  });

  it('mostra uma casa, com vírgula', () => {
    expect(textoDaRaridade(3.24)).toBe('3,2% dos jogadores');
    expect(textoDaRaridade(71)).toBe('71,0% dos jogadores');
    expect(textoDaRaridade(null)).toBeNull();
  });
});

describe('nomeDaConquista', () => {
  it('a oculta sem nome é "Conquista oculta"', () => {
    expect(nomeDaConquista(conquista({ nome: null, oculta: true }))).toBe(TEXTOS_DAS_CONQUISTAS.oculta);
    expect(TEXTOS_DAS_CONQUISTAS.oculta).toBe('Conquista oculta');
  });

  it('a que tem nome mostra o nome', () => {
    expect(nomeDaConquista(conquista())).toBe('O Louco');
  });
});

describe('sugereMarcarPlatinado', () => {
  const item = (status_consumo: string, conquistas: { obtidas: number; total: number } | null) => ({
    status_consumo,
    conquistas,
  });

  it('com todas as conquistas e fora de Platinado, sugere em qualquer Estado', () => {
    expect(sugereMarcarPlatinado(item('jogando', { obtidas: 50, total: 50 }))).toBe(true);
    expect(sugereMarcarPlatinado(item('zerado', { obtidas: 50, total: 50 }))).toBe(true);
    expect(sugereMarcarPlatinado(item('abandonado', { obtidas: 3, total: 3 }))).toBe(true);
  });

  it('some em Platinado, com conquista faltando e sem dado', () => {
    expect(sugereMarcarPlatinado(item('platinado', { obtidas: 50, total: 50 }))).toBe(false);
    expect(sugereMarcarPlatinado(item('zerado', { obtidas: 49, total: 50 }))).toBe(false);
    expect(sugereMarcarPlatinado(item('zerado', null))).toBe(false);
    expect(sugereMarcarPlatinado(null)).toBe(false);
  });

  it('mostra os textos do destaque', () => {
    expect(TEXTOS_DAS_CONQUISTAS.todas).toBe('Você tem todas as conquistas');
    expect(TEXTOS_DAS_CONQUISTAS.marcarPlatinado).toBe('Marcar Platinado');
  });
});

describe('descricaoAcessivel', () => {
  it('diz o nome, o jogo, a data em que foi obtida e a raridade, com a marca de rara', () => {
    const obtida = conquista({ obtida: true, obtida_em: '2020-12-10T15:32:36Z', raridade: 3.24 });
    expect(descricaoAcessivel(obtida, 'Hades')).toBe(
      'O Louco, Hades, obtida em 10/12/2020, 3,2% dos jogadores, rara',
    );
  });

  it('diz que falta, e a oculta sem spoiler', () => {
    const oculta = conquista({ nome: null, descricao: null, oculta: true, raridade: 40 });
    expect(descricaoAcessivel(oculta, 'Hades')).toBe('Conquista oculta, Hades, não obtida, 40,0% dos jogadores');
  });

  it('sem data nem raridade, diz só o que tem', () => {
    expect(descricaoAcessivel(conquista({ obtida: true, raridade: null }), 'Hades')).toBe('O Louco, Hades, obtida');
  });
});
