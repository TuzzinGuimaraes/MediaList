import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import type {
  ConquistaEmDestaque,
  RespostaDestaques,
  RespostaEstatisticas,
  RespostaMe,
  RespostaPermissoes,
  RespostaPreferencias,
} from '../api/tipos';
import { erro } from './contrato';
import { loginOk, simularFetch } from './fetchSimulado';
import { aba, entrarPeloLogin } from './sessao';

const me: { status: 200; corpo: RespostaMe } = {
  status: 200,
  corpo: {
    usuario: { id_usuario: 'USR-20261106-00007', nome_completo: 'Ana Souza', email: 'ana@exemplo.com', foto_perfil: null },
    deve_trocar_senha: false,
  },
};
const permissoes: { status: 200; corpo: RespostaPermissoes } = {
  status: 200,
  corpo: { permissoes: { nivel_acesso: 'usuario' } },
};

// GET /usuario/estatisticas: contagens e somas como inteiro, nota_media como número ou null.
const estatisticas: { status: 200; corpo: RespostaEstatisticas } = {
  status: 200,
  corpo: {
    estatisticas: [
      { tipo: 'anime', total_midias: 2, concluidos: 1, em_andamento: 1, nota_media: 7, favoritos: 0, progresso_total_consumido: 0 },
      { tipo: 'jogo', total_midias: 3, concluidos: 3, em_andamento: 0, nota_media: 9, favoritos: 1, progresso_total_consumido: 0 },
    ],
    resumo: { total_midias: 5, concluidos: 4, em_andamento: 1, favoritos: 1 },
  },
};

const item = (tipo: string, status_consumo: string, nota_usuario: number | null) => ({
  tipo,
  status_consumo,
  nota_usuario,
});

const lista = {
  status: 200,
  corpo: {
    lista: [
      item('anime', 'completo', 8),
      item('anime', 'assistindo', 6),
      item('jogo', 'zerado', null),
      item('jogo', 'platinado', 10),
      item('jogo', 'platinado', null),
    ],
  },
};

/** GET /preferencias, com "Avisar sobre Notícias" e "Avisar sobre episódios novos" ligados ou desligados. */
function preferencias(
  avisar_noticias: boolean,
  avisar_episodios = true,
): { status: 200; corpo: RespostaPreferencias } {
  return {
    status: 200,
    corpo: { preferencias: { tema: 'light', idioma: 'pt-BR', notificacoes_ativas: true, avisar_noticias, avisar_episodios } },
  };
}

const semConquistas: RespostaDestaques = { destaques: [], automaticos: true, total: { conquistas: 0, jogos: 0 } };

function destaques(corpo: RespostaDestaques): { status: 200; corpo: RespostaDestaques } {
  return { status: 200, corpo };
}

function destaque(codigo: string, dados: Partial<ConquistaEmDestaque> = {}): ConquistaEmDestaque {
  return {
    steam_appid: 367520,
    codigo,
    nome: `Conquista ${codigo}`,
    icone: `https://steamcdn-a.akamaihd.net/${codigo}.jpg`,
    raridade: 50,
    obtida_em: '2020-12-10T15:32:36Z',
    id_lista: 'LST-J',
    id_midia: 'MID-J',
    jogo: 'Hollow Knight',
    ...dados,
  };
}

// No Jest o manifesto vem vazio; no APK e no Expo Go a versão vem do app.json.
jest.mock('expo-constants', () => {
  const real = jest.requireActual('expo-constants').default;
  return {
    __esModule: true,
    default: Object.create(real, { expoConfig: { get: () => ({ ...real.expoConfig, version: '1.0.0' }) } }),
  };
});

async function abrirPerfil() {
  await entrarPeloLogin();
  await fireEvent.press(await aba('Perfil'));
}

function barra(nome: string) {
  return screen.findByLabelText(new RegExp(`^${nome}: `));
}

describe('estatísticas no Perfil', () => {
  beforeEach(() => {
    simularFetch({
      'POST /auth/login': loginOk({ access: 'A1', refresh: 'R1' }),
      'GET /auth/me': me,
      'GET /usuario/permissoes': permissoes,
      'GET /usuario/estatisticas': estatisticas,
      'GET /lista': lista,
      'GET /integracoes': { status: 200, corpo: { integracoes: [] } },
      'GET /preferencias': preferencias(true),
      'GET /usuario/conquistas/destaques': destaques(semConquistas),
    });
  });

  it('mostra contagens por Estado de consumo, com Platinado somado em Concluído', async () => {
    await abrirPerfil();

    expect(await barra('Concluído')).toHaveAccessibleName('Concluído: 4');
    expect(await barra('Platinado')).toHaveAccessibleName('Platinado: 2');
    expect(await barra('Em progresso')).toHaveAccessibleName('Em progresso: 1');
    expect(await barra('Planejado')).toHaveAccessibleName('Planejado: 0');
    expect(await barra('Pausado')).toHaveAccessibleName('Pausado: 0');
    expect(await barra('Abandonado')).toHaveAccessibleName('Abandonado: 0');
  });

  it('mostra os totais por Tipo de mídia vindos de /usuario/estatisticas', async () => {
    await abrirPerfil();

    expect(await barra('Anime')).toHaveAccessibleName('Anime: 2');
    expect(await barra('Mangá')).toHaveAccessibleName('Mangá: 0');
    expect(await barra('Jogo')).toHaveAccessibleName('Jogo: 3');
  });

  it('mostra a média das Notas pessoais, ignorando itens sem nota', async () => {
    await abrirPerfil();

    const media = await screen.findByLabelText(/^Média das notas pessoais/);
    expect(within(media).getByText('8,0')).toBeOnTheScreen();
  });

  it('os dados do Usuário continuam acima das estatísticas', async () => {
    await abrirPerfil();

    expect(await screen.findByText('Ana Souza')).toBeOnTheScreen();
    expect(await screen.findByText('Por Status')).toBeOnTheScreen();
  });
});

describe('estatísticas sem itens', () => {
  it('sem nenhuma Nota pessoal, a média aparece como "—"', async () => {
    simularFetch({
      'POST /auth/login': loginOk({ access: 'A1', refresh: 'R1' }),
      'GET /auth/me': me,
      'GET /usuario/permissoes': permissoes,
      'GET /usuario/estatisticas': { status: 200, corpo: { estatisticas: [], resumo: { total_midias: 0, concluidos: 0, em_andamento: 0, favoritos: 0 } } },
      'GET /lista': { status: 200, corpo: { lista: [] } },
      'GET /integracoes': { status: 200, corpo: { integracoes: [] } },
      'GET /preferencias': preferencias(true),
      'GET /usuario/conquistas/destaques': destaques(semConquistas),
    });
    await abrirPerfil();

    const media = await screen.findByLabelText(/^Média das notas pessoais/);
    expect(within(media).getByText('—')).toBeOnTheScreen();
    expect(await barra('Concluído')).toHaveAccessibleName('Concluído: 0');
  });
});

describe('estatísticas com erro', () => {
  it('se as estatísticas falham, o Perfil mostra os dados do Usuário e permite tentar de novo', async () => {
    let falhar = true;
    simularFetch({
      'POST /auth/login': loginOk({ access: 'A1', refresh: 'R1' }),
      'GET /auth/me': me,
      'GET /usuario/permissoes': permissoes,
      'GET /usuario/estatisticas': () => (falhar ? erro(500, 'erro_interno', 'Erro ao buscar estatísticas') : estatisticas),
      'GET /lista': lista,
      'GET /integracoes': { status: 200, corpo: { integracoes: [] } },
      'GET /preferencias': preferencias(true),
      'GET /usuario/conquistas/destaques': destaques(semConquistas),
    });
    await abrirPerfil();

    expect(await screen.findByText('Ana Souza')).toBeOnTheScreen();
    expect(await screen.findByText('Erro ao buscar estatísticas', {}, { timeout: 3000 })).toBeOnTheScreen();

    falhar = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await barra('Jogo')).toHaveAccessibleName('Jogo: 3');
  });
});

describe('versão do app no Perfil', () => {
  const Updates = jest.requireMock('expo-updates');

  beforeEach(() => {
    simularFetch({
      'POST /auth/login': loginOk({ access: 'A1', refresh: 'R1' }),
      'GET /auth/me': me,
      'GET /usuario/permissoes': permissoes,
      'GET /usuario/estatisticas': estatisticas,
      'GET /lista': lista,
      'GET /integracoes': { status: 200, corpo: { integracoes: [] } },
      'GET /preferencias': preferencias(true),
      'GET /usuario/conquistas/destaques': destaques(semConquistas),
    });
  });

  it('fora de build (dev, Expo Go) mostra só a versão, sem update nem botão', async () => {
    await abrirPerfil();

    expect(await screen.findByText('1.0.0')).toBeOnTheScreen();
    expect(screen.queryByText(/embutido/)).not.toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Atualizar agora' })).not.toBeOnTheScreen();
  });

  it('no APK sem update baixado, mostra a versão e "embutido"', async () => {
    Updates.__definir({ ativo: true, isEmbeddedLaunch: true, updateId: 'f0e1d2c3-0000-4000-8000-000000000000' });
    await abrirPerfil();

    expect(await screen.findByText('1.0.0 · embutido')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Atualizar agora' })).not.toBeOnTheScreen();
  });

  it('com um update em execução, mostra o id curto dele', async () => {
    Updates.__definir({ ativo: true, updateId: 'a1b2c3d4-5e6f-4a7b-8c9d-0e1f2a3b4c5d' });
    await abrirPerfil();

    expect(await screen.findByText('1.0.0 · update a1b2c3d4')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Atualizar agora' })).not.toBeOnTheScreen();
  });

  it('com um update baixado e pendente, "Atualizar agora" recarrega o app', async () => {
    Updates.__definir({ ativo: true, isEmbeddedLaunch: true, isUpdatePending: true });
    await abrirPerfil();

    await fireEvent.press(await screen.findByRole('button', { name: 'Atualizar agora' }));

    expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
  });
});

describe('Avisos no Perfil', () => {
  function api(
    avisar: boolean,
    put: (corpo: unknown) => { status: number; corpo?: unknown },
    avisarEpisodios = true,
  ) {
    return simularFetch({
      'POST /auth/login': loginOk({ access: 'A1', refresh: 'R1' }),
      'GET /auth/me': me,
      'GET /usuario/permissoes': permissoes,
      'GET /usuario/estatisticas': estatisticas,
      'GET /lista': lista,
      'GET /integracoes': { status: 200, corpo: { integracoes: [] } },
      'GET /preferencias': preferencias(avisar, avisarEpisodios),
      'PUT /preferencias': (req) => put(req.corpo),
      'GET /usuario/conquistas/destaques': destaques(semConquistas),
    });
  }

  it('"Avisar sobre episódios novos" mostra o estado salvo e desliga sem mexer nas Notícias', async () => {
    const fetch = api(true, () => ({ status: 200, corpo: { mensagem: 'ok', modificado: true } }));
    await abrirPerfil();

    const chave = await screen.findByRole('switch', { name: 'Avisar sobre episódios novos' });
    expect(chave).toBeChecked();
    await fireEvent(chave, 'valueChange', false);

    await waitFor(() => expect(fetch.para('PUT /preferencias')).toHaveLength(1));
    expect(fetch.para('PUT /preferencias')[0].corpo).toEqual({ avisar_episodios: false });
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Avisar sobre episódios novos' })).not.toBeChecked(),
    );
    expect(screen.getByRole('switch', { name: 'Avisar sobre Notícias' })).toBeChecked();
  });

  it('"Avisar sobre episódios novos" desligado liga com PUT /preferencias', async () => {
    const fetch = api(true, () => ({ status: 200, corpo: { mensagem: 'ok', modificado: true } }), false);
    await abrirPerfil();

    const chave = await screen.findByRole('switch', { name: 'Avisar sobre episódios novos' });
    expect(chave).not.toBeChecked();
    await fireEvent(chave, 'valueChange', true);

    await waitFor(() => expect(fetch.para('PUT /preferencias')).toHaveLength(1));
    expect(fetch.para('PUT /preferencias')[0].corpo).toEqual({ avisar_episodios: true });
  });

  it('mostra o estado salvo e desliga com PUT /preferencias', async () => {
    const fetch = api(true, () => ({ status: 200, corpo: { mensagem: 'ok', modificado: true } }));
    await abrirPerfil();

    const chave = await screen.findByRole('switch', { name: 'Avisar sobre Notícias' });
    expect(chave).toBeChecked();
    await fireEvent(chave, 'valueChange', false);

    await waitFor(() => expect(fetch.para('PUT /preferencias')).toHaveLength(1));
    expect(fetch.para('PUT /preferencias')[0].corpo).toEqual({ avisar_noticias: false });
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Avisar sobre Notícias' })).not.toBeChecked());
  });

  it('se salvar falha, volta ao estado anterior e mostra o erro', async () => {
    api(false, () => erro(500, 'erro_interno', 'Erro ao salvar'));
    await abrirPerfil();

    const chave = await screen.findByRole('switch', { name: 'Avisar sobre Notícias' });
    expect(chave).not.toBeChecked();
    await fireEvent(chave, 'valueChange', true);

    expect(await screen.findByText('Erro ao salvar', {}, { timeout: 3000 })).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'Avisar sobre Notícias' })).not.toBeChecked();
  });
});

describe('Conquistas em destaque no Perfil', () => {
  function rotas(corpo: RespostaDestaques) {
    return simularFetch({
      'POST /auth/login': loginOk({ access: 'A1', refresh: 'R1' }),
      'GET /auth/me': me,
      'GET /usuario/permissoes': permissoes,
      'GET /usuario/estatisticas': estatisticas,
      'GET /lista': lista,
      'GET /integracoes': { status: 200, corpo: { integracoes: [] } },
      'GET /preferencias': preferencias(true),
      'GET /usuario/conquistas/destaques': destaques(corpo),
    });
  }

  it('mostra cada destaque com nome, jogo, raridade e data, e o total', async () => {
    rotas({
      destaques: [destaque('Rara', { raridade: 3.24 }), destaque('Comum', { raridade: 71, jogo: 'Celeste' })],
      automaticos: false,
      total: { conquistas: 412, jogos: 37 },
    });

    await abrirPerfil();

    expect(await screen.findByText('Conquistas em destaque')).toBeOnTheScreen();
    expect(screen.getByText('412 conquistas em 37 jogos')).toBeOnTheScreen();
    const rara = screen.getByLabelText('Conquista Rara, Hollow Knight, obtida em 10/12/2020, 3,2% dos jogadores, rara');
    expect(within(rara).getByText('Hollow Knight')).toBeOnTheScreen();
    expect(within(rara).getByText('3,2% dos jogadores')).toBeOnTheScreen();
    expect(within(rara).getByText('Obtida em 10/12/2020')).toBeOnTheScreen();
    expect(within(rara).getByText('Rara')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Conquista Comum, Celeste/)).toBeOnTheScreen();
    expect(screen.queryByText(/mais raras/)).not.toBeOnTheScreen();
  });

  it('sem escolha, as automáticas vêm com a dica', async () => {
    rotas({ destaques: [destaque('A')], automaticos: true, total: { conquistas: 1, jogos: 1 } });

    await abrirPerfil();

    expect(await screen.findByText('1 conquista em 1 jogo')).toBeOnTheScreen();
    expect(screen.getByText(/Estas são as suas conquistas mais raras/)).toBeOnTheScreen();
  });

  it('"Escolher destaques" abre a tela do seletor', async () => {
    const api = simularFetch({
      'POST /auth/login': loginOk({ access: 'A1', refresh: 'R1' }),
      'GET /auth/me': me,
      'GET /usuario/permissoes': permissoes,
      'GET /usuario/estatisticas': estatisticas,
      'GET /lista': lista,
      'GET /integracoes': { status: 200, corpo: { integracoes: [] } },
      'GET /preferencias': preferencias(true),
      'GET /usuario/conquistas/destaques': destaques({
        destaques: [destaque('A')],
        automaticos: true,
        total: { conquistas: 1, jogos: 1 },
      }),
      'GET /usuario/conquistas/jogos': { status: 200, corpo: { jogos: [] } },
      'GET /usuario/conquistas?ordem=raridade&pagina=1': {
        status: 200,
        corpo: { itens: [], pagina: 1, por_pagina: 50, total: 0 },
      },
    });

    await abrirPerfil();
    await fireEvent.press(await screen.findByRole('button', { name: 'Escolher destaques' }));

    expect(await screen.findByRole('header', { name: 'Escolher destaques' })).toBeOnTheScreen();
    await waitFor(() => expect(api.para('GET /usuario/conquistas?ordem=raridade&pagina=1')).toHaveLength(1));
  });

  it('sem nenhuma conquista obtida, a seção some', async () => {
    const api = rotas(semConquistas);

    await abrirPerfil();

    await screen.findByText('Ana Souza');
    await waitFor(() => expect(api.para('GET /usuario/conquistas/destaques')).toHaveLength(1));
    expect(screen.queryByText('Conquistas em destaque')).not.toBeOnTheScreen();
  });
});
