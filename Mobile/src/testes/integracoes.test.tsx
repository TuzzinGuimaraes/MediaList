import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import { Linking } from 'react-native';

import type { components } from '../../../contrato/api';
import { vibrarConfirmacao } from '../tema/haptics';
import { erro } from './contrato';
import { loginOk, simularFetch } from './fetchSimulado';
import { aba, entrarPeloLogin } from './sessao';

jest.mock('../tema/haptics', () => ({ vibrarConfirmacao: jest.fn() }));

type Esquemas = components['schemas'];
type Integracao = Esquemas['Integracao'];

function integracao(extra: Partial<Integracao> = {}): Integracao {
  return {
    plataforma: 'anilist',
    rotulo: 'AniList',
    disponivel: true,
    conectada: false,
    identificador: null,
    nome_exibicao: null,
    ultima_sincronizacao: null,
    ultimo_resultado: null,
    ...extra,
  };
}

const conectadaAoAniList = integracao({ conectada: true, identificador: 'Ana', nome_exibicao: 'Ana' });
const steam = (extra: Partial<Integracao> = {}) => integracao({ plataforma: 'steam', rotulo: 'Steam', ...extra });

const previa: Esquemas['PreviaImportacao'] = {
  id_previa: 'PRV-1',
  expira_em: '2026-11-25T13:00:00+00:00',
  novos: 32,
  atualizados: 5,
  nao_encontrados: [{ titulo: 'Obra rara', link: 'https://anilist.co/anime/9' }],
  total_nao_encontrados: 3,
};

const rotasDoPerfil = (extra: Record<string, Parameters<typeof simularFetch>[0][string]>) => ({
  'POST /auth/login': loginOk({ access: 'A1', refresh: 'R1' }),
  'GET /auth/me': {
    status: 200,
    corpo: {
      usuario: { id_usuario: 'USR-20261106-00007', nome_completo: 'Ana Souza', email: 'ana@exemplo.com', foto_perfil: null },
      deve_trocar_senha: false,
    },
  },
  'GET /usuario/permissoes': { status: 200, corpo: { permissoes: { nivel_acesso: 'usuario' } } },
  'GET /usuario/estatisticas': {
    status: 200,
    corpo: { estatisticas: [], resumo: { total_midias: 0, concluidos: 0, em_andamento: 0, favoritos: 0 } },
  },
  'GET /lista': { status: 200, corpo: { lista: [] } },
  ...extra,
});

async function plataforma(rotulo: string) {
  await entrarPeloLogin();
  await fireEvent.press(await aba('Perfil'));
  return screen.findByLabelText(rotulo);
}

describe('Perfil: Integrações', () => {
  it('conecta o AniList pelo nome de usuário', async () => {
    let conectada = false;
    const api = simularFetch(
      rotasDoPerfil({
        'GET /integracoes': () => ({ status: 200, corpo: { integracoes: [conectada ? conectadaAoAniList : integracao()] } }),
        'PUT /integracoes/anilist': () => {
          conectada = true;
          return { status: 200, corpo: conectadaAoAniList };
        },
      }),
    );
    const anilist = await plataforma('AniList');

    await fireEvent.changeText(within(anilist).getByLabelText('Nome de usuário do AniList'), ' Ana ');
    await fireEvent.press(within(anilist).getByRole('button', { name: 'Conectar' }));

    expect(api.para('PUT /integracoes/anilist')[0]?.corpo).toEqual({ identificador: 'Ana' });
    expect(await within(anilist).findByText('Ana')).toBeOnTheScreen();
    expect(within(anilist).getByRole('button', { name: 'Importar' })).toBeOnTheScreen();
    expect(vibrarConfirmacao).not.toHaveBeenCalled();
  });

  it('perfil privado mostra a mensagem da API', async () => {
    simularFetch(
      rotasDoPerfil({
        'GET /integracoes': { status: 200, corpo: { integracoes: [integracao()] } },
        'PUT /integracoes/anilist': erro(400, 'perfil_privado', 'O perfil do AniList é privado. Deixe o perfil público.'),
      }),
    );
    const anilist = await plataforma('AniList');

    await fireEvent.changeText(within(anilist).getByLabelText('Nome de usuário do AniList'), 'ana');
    await fireEvent.press(within(anilist).getByRole('button', { name: 'Conectar' }));

    expect(await within(anilist).findByRole('alert')).toHaveTextContent(/Deixe o perfil público/);
  });

  it('importar mostra a prévia e só grava ao confirmar; depois refaz a Lista e as estatísticas', async () => {
    const api = simularFetch(
      rotasDoPerfil({
        'GET /integracoes': { status: 200, corpo: { integracoes: [conectadaAoAniList] } },
        'POST /integracoes/anilist/previa': { status: 200, corpo: previa },
        'POST /integracoes/previas/PRV-1/confirmar': {
          status: 200,
          corpo: { novos: 32, atualizados: 5, nao_encontrados: previa.nao_encontrados, total_nao_encontrados: 3 },
        },
      }),
    );
    const anilist = await plataforma('AniList');

    await fireEvent.press(await within(anilist).findByRole('button', { name: 'Importar' }));

    const caixa = await within(anilist).findByLabelText('Prévia da importação');
    expect(within(caixa).getByText('32 novos · 5 atualizados · 3 não encontrados')).toBeOnTheScreen();
    expect(api.para('POST /integracoes/previas/PRV-1/confirmar')).toHaveLength(0);
    const listas = api.para('GET /lista').length;
    const estatisticas = api.para('GET /usuario/estatisticas').length;

    await fireEvent.press(within(caixa).getByRole('button', { name: 'Confirmar' }));

    expect(await within(anilist).findByText('Importado: 32 novos · 5 atualizados · 3 não encontrados')).toBeOnTheScreen();
    expect(api.para('POST /integracoes/previas/PRV-1/confirmar')).toHaveLength(1);
    expect(vibrarConfirmacao).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(api.para('GET /lista').length).toBeGreaterThan(listas));
    await waitFor(() => expect(api.para('GET /usuario/estatisticas').length).toBeGreaterThan(estatisticas));
  });

  it('Não encontrados abrem o link no navegador e mostram quantos ficaram fora da amostra', async () => {
    const abrir = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    simularFetch(
      rotasDoPerfil({
        'GET /integracoes': { status: 200, corpo: { integracoes: [conectadaAoAniList] } },
        'POST /integracoes/anilist/previa': {
          status: 200,
          corpo: { ...previa, nao_encontrados: [...previa.nao_encontrados, { titulo: 'Sem link', link: null }] },
        },
      }),
    );
    const anilist = await plataforma('AniList');
    await fireEvent.press(await within(anilist).findByRole('button', { name: 'Importar' }));
    const caixa = await within(anilist).findByLabelText('Prévia da importação');

    expect(within(caixa).queryByRole('link', { name: 'Obra rara' })).not.toBeOnTheScreen();
    await fireEvent.press(within(caixa).getByRole('button', { name: 'Não encontrados: adicione à mão' }));

    await fireEvent.press(within(caixa).getByRole('link', { name: 'Obra rara' }));
    expect(abrir).toHaveBeenCalledWith('https://anilist.co/anime/9');
    expect(within(caixa).getByText('Sem link')).toBeOnTheScreen();
    expect(within(caixa).queryByRole('link', { name: 'Sem link' })).not.toBeOnTheScreen();
    expect(within(caixa).getByText('e mais 1')).toBeOnTheScreen();
  });

  it('prévia sem nada novo não oferece confirmar', async () => {
    simularFetch(
      rotasDoPerfil({
        'GET /integracoes': { status: 200, corpo: { integracoes: [conectadaAoAniList] } },
        'POST /integracoes/anilist/previa': {
          status: 200,
          corpo: { ...previa, novos: 0, atualizados: 0, nao_encontrados: [], total_nao_encontrados: 0 },
        },
      }),
    );
    const anilist = await plataforma('AniList');
    await fireEvent.press(await within(anilist).findByRole('button', { name: 'Importar' }));

    const caixa = await within(anilist).findByLabelText('Prévia da importação');
    expect(within(caixa).getByText('Nada novo')).toBeOnTheScreen();
    expect(within(caixa).queryByRole('button', { name: 'Confirmar' })).not.toBeOnTheScreen();
    await fireEvent.press(within(caixa).getByRole('button', { name: 'Fechar' }));
    expect(await within(anilist).findByRole('button', { name: 'Importar' })).toBeOnTheScreen();
  });

  it('mostra a última importação e desconecta', async () => {
    let conectada = true;
    const api = simularFetch(
      rotasDoPerfil({
        'GET /integracoes': () => ({
          status: 200,
          corpo: {
            integracoes: [
              conectada ? { ...conectadaAoAniList, ultima_sincronizacao: '2026-11-24T10:00:00+00:00' } : integracao(),
            ],
          },
        }),
        'DELETE /integracoes/anilist': () => {
          conectada = false;
          return { status: 200, corpo: { mensagem: 'Conta desconectada' } };
        },
      }),
    );
    const anilist = await plataforma('AniList');
    expect(await within(anilist).findByText(/última importação em 24\/11\/2026/)).toBeOnTheScreen();

    await fireEvent.press(within(anilist).getByRole('button', { name: 'Desconectar' }));

    expect(api.para('DELETE /integracoes/anilist')).toHaveLength(1);
    expect(await within(anilist).findByLabelText('Nome de usuário do AniList')).toBeOnTheScreen();
    expect(vibrarConfirmacao).not.toHaveBeenCalled();
  });

  it('plataforma sem chave no servidor aparece indisponível', async () => {
    simularFetch(
      rotasDoPerfil({
        'GET /integracoes': { status: 200, corpo: { integracoes: [integracao(), steam({ disponivel: false })] } },
      }),
    );
    const item = await plataforma('Steam');

    expect(within(item).getByText('Indisponível no momento.')).toBeOnTheScreen();
    expect(within(item).queryByRole('button')).not.toBeOnTheScreen();
  });

  it('o MyAnimeList conecta pelo nome de usuário e não tem envio de XML no app', async () => {
    const api = simularFetch(
      rotasDoPerfil({
        'GET /integracoes': { status: 200, corpo: { integracoes: [integracao({ plataforma: 'mal', rotulo: 'MyAnimeList' })] } },
        'PUT /integracoes/mal': {
          status: 200,
          corpo: integracao({ plataforma: 'mal', rotulo: 'MyAnimeList', conectada: true, identificador: 'Ana' }),
        },
      }),
    );
    const mal = await plataforma('MyAnimeList');

    expect(within(mal).queryByText(/XML/)).not.toBeOnTheScreen();
    await fireEvent.changeText(within(mal).getByLabelText('Nome de usuário do MyAnimeList'), 'Ana');
    await fireEvent.press(within(mal).getByRole('button', { name: 'Conectar' }));
    await waitFor(() => expect(api.para('PUT /integracoes/mal')[0]?.corpo).toEqual({ identificador: 'Ana' }));
  });

  it('Steam conectada: sem Importar, "Sincronizar agora" grava direto e mostra os pendentes', async () => {
    const api = simularFetch(
      rotasDoPerfil({
        'GET /integracoes': {
          status: 200,
          corpo: { integracoes: [steam({ conectada: true, identificador: '7656', nome_exibicao: 'ana_gamer' })] },
        },
        'POST /integracoes/steam/sincronizar': {
          status: 200,
          corpo: { novos: 3, atualizados: 1, nao_encontrados: [], total_nao_encontrados: 0, pendentes: 12 },
        },
      }),
    );
    const item = await plataforma('Steam');
    expect(await within(item).findByText('ana_gamer')).toBeOnTheScreen();
    expect(within(item).queryByRole('button', { name: 'Importar' })).not.toBeOnTheScreen();
    const listas = api.para('GET /lista').length;

    await fireEvent.press(within(item).getByRole('button', { name: 'Sincronizar agora' }));

    expect(await within(item).findByText('Sincronizado: 3 novos · 1 atualizado')).toBeOnTheScreen();
    expect(within(item).getByText('12 jogos ainda em processamento; o resto entra na sincronização diária.')).toBeOnTheScreen();
    expect(vibrarConfirmacao).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(api.para('GET /lista').length).toBeGreaterThan(listas));
  });

  it('se as integrações falham, o resto do Perfil aparece e dá para tentar de novo', async () => {
    let falhar = true;
    simularFetch(
      rotasDoPerfil({
        'GET /integracoes': () =>
          falhar ? erro(500, 'erro_interno', 'Erro ao buscar integrações') : { status: 200, corpo: { integracoes: [integracao()] } },
      }),
    );
    await entrarPeloLogin();
    await fireEvent.press(await aba('Perfil'));

    expect(await screen.findByText('Erro ao buscar integrações', {}, { timeout: 3000 })).toBeOnTheScreen();
    expect(screen.getByText('Ana Souza')).toBeOnTheScreen();
    falhar = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByLabelText('AniList')).toBeOnTheScreen();
  });
});
