import { fireEvent, screen, within } from 'expo-router/testing-library';

import { loginOk, simularFetch } from './fetchSimulado';
import { aba, entrarPeloLogin } from './sessao';

const me = {
  status: 200,
  corpo: {
    usuario: { id_usuario: 'USR-20261106-00007', nome_completo: 'Ana Souza', email: 'ana@exemplo.com', foto_perfil: null },
  },
};
const permissoes = { status: 200, corpo: { permissoes: { nivel_acesso: 'usuario', grupos: 'Usuários' } } };

// Formato real de GET /usuario/estatisticas: contagens e somas como inteiro, nota_media como número ou null.
const estatisticas = {
  status: 200,
  corpo: {
    estatisticas: [
      { tipo: 'anime', label: 'Anime', total_midias: 2, concluidos: 1, em_andamento: 1, nota_media: 7, favoritos: 0, progresso_total_consumido: 0 },
      { tipo: 'jogo', label: 'Jogo', total_midias: 3, concluidos: 3, em_andamento: 0, nota_media: 9, favoritos: 1, progresso_total_consumido: 0 },
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
      'GET /usuario/estatisticas': () => (falhar ? { status: 500, corpo: { erro: 'Erro ao buscar estatísticas' } } : estatisticas),
      'GET /lista': lista,
    });
    await abrirPerfil();

    expect(await screen.findByText('Ana Souza')).toBeOnTheScreen();
    expect(await screen.findByText('Erro ao buscar estatísticas', {}, { timeout: 3000 })).toBeOnTheScreen();

    falhar = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await barra('Jogo')).toHaveAccessibleName('Jogo: 3');
  });
});
