import {
  consultaDoSeletor,
  descricaoAcessivel,
  descricaoDoDestaque,
  eLimiteDeDestaques,
  eRara,
  FILTROS_INICIAIS_DO_SELETOR,
  mostraDestaquesNoPerfil,
  nomeDaConquista,
  ORDENS_DO_SELETOR,
  proximaPaginaDoSeletor,
  sugereMarcarPlatinado,
  TEXTOS_DAS_CONQUISTAS,
  textoDaRaridade,
  textoDoResumo,
  textoDoTotal,
} from './conquistas';
import type { ConquistaDoItem, ConquistaEmDestaque } from './tipos';

function conquista(dados: Partial<ConquistaDoItem> = {}): ConquistaDoItem {
  return {
    steam_appid: 10,
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

describe('textoDoTotal', () => {
  it('diz quantas conquistas em quantos jogos', () => {
    expect(textoDoTotal({ conquistas: 412, jogos: 37 })).toBe('412 conquistas em 37 jogos');
  });

  it('no singular com uma só', () => {
    expect(textoDoTotal({ conquistas: 1, jogos: 1 })).toBe('1 conquista em 1 jogo');
  });

  it('sem nenhuma obtida não diz nada', () => {
    expect(textoDoTotal({ conquistas: 0, jogos: 0 })).toBeNull();
  });
});

describe('mostraDestaquesNoPerfil', () => {
  it('some sem nenhuma conquista obtida e sem resposta', () => {
    expect(mostraDestaquesNoPerfil({ total: { conquistas: 0, jogos: 0 } })).toBe(false);
    expect(mostraDestaquesNoPerfil(undefined)).toBe(false);
  });

  it('aparece com alguma obtida', () => {
    expect(mostraDestaquesNoPerfil({ total: { conquistas: 3, jogos: 1 } })).toBe(true);
  });
});

describe('textos dos destaques', () => {
  it('a seção, os botões, a dica dos automáticos e o aviso do sétimo', () => {
    expect(TEXTOS_DAS_CONQUISTAS.emDestaque).toBe('Conquistas em destaque');
    expect(TEXTOS_DAS_CONQUISTAS.destacar).toBe('Destacar no Perfil');
    expect(TEXTOS_DAS_CONQUISTAS.tirar).toBe('Tirar do Perfil');
    expect(TEXTOS_DAS_CONQUISTAS.dicaAutomaticos).toMatch(/mais raras/);
    expect(TEXTOS_DAS_CONQUISTAS.limiteDeDestaques).toMatch(/6 destaques.*Tire um/);
  });

  it('reconhece o 409 do sétimo pelo código', () => {
    expect(eLimiteDeDestaques({ codigo: 'limite_de_destaques' })).toBe(true);
    expect(eLimiteDeDestaques({ codigo: 'conflito' })).toBe(false);
    expect(eLimiteDeDestaques(new Error('x'))).toBe(false);
    expect(eLimiteDeDestaques(null)).toBe(false);
  });
});

describe('descricaoDoDestaque', () => {
  it('diz o nome, o jogo, quando foi obtida e a raridade', () => {
    const destaque: ConquistaEmDestaque = {
      steam_appid: 10,
      codigo: 'A',
      nome: 'O Louco',
      icone: null,
      raridade: 3.24,
      obtida_em: '2020-12-10T15:32:36Z',
      id_lista: 'l1',
      id_midia: 'm1',
      jogo: 'Hades',
    };
    expect(descricaoDoDestaque(destaque)).toBe('O Louco, Hades, obtida em 10/12/2020, 3,2% dos jogadores, rara');
  });
});


describe('seletor de destaques', () => {
  it('monta a query só com os filtros escolhidos', () => {
    expect(consultaDoSeletor(FILTROS_INICIAIS_DO_SELETOR, 1)).toEqual({ ordem: 'raridade', pagina: 1 });
    expect(
      consultaDoSeletor({ busca: '  ação ', steamAppid: 620, soDestacadas: true, ordem: 'data' }, 3),
    ).toEqual({ busca: 'ação', steam_appid: 620, so_destacadas: true, ordem: 'data', pagina: 3 });
    expect(consultaDoSeletor({ ...FILTROS_INICIAIS_DO_SELETOR, busca: '   ' }, 1)).toEqual({
      ordem: 'raridade',
      pagina: 1,
    });
  });

  it('a próxima página existe enquanto as lidas não somam o total', () => {
    expect(proximaPaginaDoSeletor({ pagina: 1, por_pagina: 50, total: 120 })).toBe(2);
    expect(proximaPaginaDoSeletor({ pagina: 3, por_pagina: 50, total: 120 })).toBeUndefined();
    expect(proximaPaginaDoSeletor({ pagina: 1, por_pagina: 50, total: 50 })).toBeUndefined();
    expect(proximaPaginaDoSeletor({ pagina: 1, por_pagina: 50, total: 0 })).toBeUndefined();
  });

  it('tem as duas ordens, raridade primeiro, e os textos do seletor', () => {
    expect(ORDENS_DO_SELETOR.map((o) => o.valor)).toEqual(['raridade', 'data']);
    expect(TEXTOS_DAS_CONQUISTAS.escolherDestaques).toBe('Escolher destaques');
    expect(TEXTOS_DAS_CONQUISTAS.todosOsJogos).toBe('Todos os jogos');
    expect(TEXTOS_DAS_CONQUISTAS.soDestacadas).toBe('Só as destacadas');
    expect(TEXTOS_DAS_CONQUISTAS.carregarMais).toBe('Carregar mais');
    expect(TEXTOS_DAS_CONQUISTAS.nenhumaNoSeletor).toMatch(/Nenhuma conquista/);
  });
});
