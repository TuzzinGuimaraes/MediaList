import { fireEvent, screen, within } from 'expo-router/testing-library';

import type { RespostaEstatisticas, RespostaMe, RespostaPermissoes } from '../api/tipos';
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
