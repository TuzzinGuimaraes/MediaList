import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { TextInput } from 'react-native';

import type { RespostaMe } from '../api/tipos';
import { erro } from './contrato';
import { type Resposta, loginOk, simularFetch, usuarioAna } from './fetchSimulado';
import { APP, aba, abrirLogado, preencherLogin } from './sessao';

const TITULO = 'Defina sua nova senha';
const TEMPORARIA = 'Tk7pQ2mX';

const loginComTemporaria: Resposta = {
  status: 200,
  corpo: { ...(loginOk({ access: 'A1', refresh: 'R1' }).corpo as object), deve_trocar_senha: true },
};
const trocaObrigatoria = erro(403, 'troca_de_senha_obrigatoria', 'Defina uma nova senha para continuar');
const trocaOk: Resposta = { status: 200, corpo: { access_token: 'A3', refresh_token: 'R3' } };

function me(deveTrocar: boolean): Resposta {
  const corpo: RespostaMe = {
    usuario: { id_usuario: usuarioAna.id, nome_completo: usuarioAna.nome, email: usuarioAna.email, foto_perfil: null },
    deve_trocar_senha: deveTrocar,
  };
  return { status: 200, corpo };
}

const titulo = () => screen.findByRole('header', { name: TITULO });

/** Entra com a Senha temporária e espera a tela de troca. */
async function entrarComTemporaria(rotas: Record<string, Resposta> = {}) {
  const api = simularFetch({ 'POST /auth/login': loginComTemporaria, ...rotas });
  const app = await renderRouter(APP, { initialUrl: '/' });
  await preencherLogin(usuarioAna.email, TEMPORARIA);
  await titulo();
  return { api, app };
}

async function preencherTroca(atual: string, nova: string, confirmacao = nova) {
  await fireEvent.changeText(screen.getByLabelText('Senha temporária'), atual);
  await fireEvent.changeText(screen.getByLabelText('Nova senha'), nova);
  await fireEvent.changeText(screen.getByLabelText('Confirme a nova senha'), confirmacao);
  await fireEvent.press(screen.getByRole('button', { name: 'Salvar nova senha' }));
}

describe('Senha temporária', () => {
  it('entrar com ela leva direto a "Defina sua nova senha", sem as abas', async () => {
    const { api } = await entrarComTemporaria();

    expect(screen.queryByRole('button', { name: /^Início, tab/ })).not.toBeOnTheScreen();
    // Nenhuma tela autenticada carregou por trás.
    expect(api.chamadas.map((c) => `${c.metodo} ${c.caminho}`)).toEqual(['POST /auth/login']);
  });

  it('reabrir o app com a troca pendente volta à tela, mesmo por um link', async () => {
    const { app } = await entrarComTemporaria();
    await app.unmount();

    await renderRouter(APP, { initialUrl: '/midia/MID-1' });

    expect(await titulo()).toBeOnTheScreen();
  });

  it('o 403 troca_de_senha_obrigatoria em qualquer chamada leva à tela', async () => {
    // A flag apareceu depois do login (o admin redefiniu a senha com o app aberto).
    simularFetch({
      'GET /auth/me': me(false),
      'GET /usuario/permissoes': trocaObrigatoria,
      'GET /usuario/estatisticas': trocaObrigatoria,
    });
    await abrirLogado('/perfil');

    expect(await titulo()).toBeOnTheScreen();
  });

  it('o /auth/me com deve_trocar_senha leva à tela', async () => {
    simularFetch({
      'GET /auth/me': me(true),
      'GET /usuario/permissoes': trocaObrigatoria,
      'GET /usuario/estatisticas': trocaObrigatoria,
    });
    await abrirLogado('/perfil');

    expect(await titulo()).toBeOnTheScreen();
  });

  it('outro 403 não leva à tela', async () => {
    simularFetch({
      'GET /auth/me': me(false),
      'GET /usuario/permissoes': erro(403, 'acesso_negado', 'Acesso negado'),
      'GET /usuario/estatisticas': erro(403, 'acesso_negado', 'Acesso negado'),
    });
    await abrirLogado('/perfil');

    expect(await screen.findByText('Acesso negado')).toBeOnTheScreen();
    expect(screen.queryByRole('header', { name: TITULO })).not.toBeOnTheScreen();
  });

  it('trocar a senha manda a temporária e a nova, guarda os tokens novos e segue para o Início', async () => {
    const { api, app } = await entrarComTemporaria({ 'POST /auth/trocar-senha': trocaOk });

    await preencherTroca(TEMPORARIA, 'minhaNova1');

    expect(await aba('Início')).toBeOnTheScreen();
    const [troca] = api.para('POST /auth/trocar-senha');
    expect(troca.corpo).toEqual({ senha_atual: TEMPORARIA, nova_senha: 'minhaNova1' });
    expect(troca.autorizacao).toBe('Bearer A1');

    // Reaberto, o app segue nas abas com o par novo.
    await app.unmount();
    const reaberto = simularFetch({
      'GET /auth/me': me(false),
      'GET /usuario/permissoes': { status: 200, corpo: { permissoes: usuarioAna.permissoes } },
    });
    await renderRouter(APP, { initialUrl: '/perfil' });
    expect(await screen.findByText('Ana Souza')).toBeOnTheScreen();
    expect(reaberto.para('GET /auth/me')[0].autorizacao).toBe('Bearer A3');
    expect(screen.queryByRole('header', { name: TITULO })).not.toBeOnTheScreen();
  });

  it('o teclado passa pelos três campos e envia; o olho em cada um volta a ocultar ao enviar', async () => {
    const { api } = await entrarComTemporaria({ 'POST /auth/trocar-senha': trocaOk });
    const focus = TextInput.prototype.focus as unknown as jest.Mock;
    focus.mockClear();
    const campos = ['Senha temporária', 'Nova senha', 'Confirme a nova senha'];
    const valores = [TEMPORARIA, '12345', '12345'];
    for (const [i, rotulo] of campos.entries()) {
      await fireEvent.changeText(screen.getByLabelText(rotulo), valores[i]);
    }

    const olhos = screen.getAllByRole('button', { name: 'Mostrar senha' });
    expect(olhos).toHaveLength(3);
    for (const olho of olhos) await fireEvent.press(olho);
    expect(campos.map((r) => screen.getByLabelText(r).props.secureTextEntry)).toEqual([false, false, false]);

    for (const rotulo of campos.slice(0, 2)) {
      expect(screen.getByLabelText(rotulo).props.returnKeyType).toBe('next');
      await fireEvent(screen.getByLabelText(rotulo), 'submitEditing');
    }
    expect(focus.mock.contexts.map((c: { props: { accessibilityLabel: string } }) => c.props.accessibilityLabel)).toEqual(
      campos.slice(1),
    );
    expect(screen.getByLabelText(campos[2]).props.returnKeyType).toBe('go');
    await fireEvent(screen.getByLabelText(campos[2]), 'submitEditing');

    // Enviou (e a validação recusou a nova curta): as três voltam a ficar ocultas.
    expect(await screen.findByRole('alert')).toHaveTextContent('A nova senha precisa ter pelo menos 6 caracteres.');
    expect(campos.map((r) => screen.getByLabelText(r).props.secureTextEntry)).toEqual([true, true, true]);
    expect(api.para('POST /auth/trocar-senha')).toHaveLength(0);
  });

  it('valida antes de enviar: nova curta ou igual à temporária', async () => {
    const { api } = await entrarComTemporaria({ 'POST /auth/trocar-senha': trocaOk });

    await preencherTroca(TEMPORARIA, '12345');
    expect(await screen.findByRole('alert')).toHaveTextContent('A nova senha precisa ter pelo menos 6 caracteres.');

    await preencherTroca(TEMPORARIA, TEMPORARIA);
    expect(screen.getByRole('alert')).toHaveTextContent('A nova senha precisa ser diferente da atual.');

    expect(api.para('POST /auth/trocar-senha')).toHaveLength(0);
  });

  it('senha temporária errada mostra o motivo do servidor e continua na tela', async () => {
    await entrarComTemporaria({
      'POST /auth/trocar-senha': {
        status: 400,
        corpo: { erro: 'Senha atual incorreta', codigo: 'dados_invalidos', detalhes: { senha_atual: 'Senha atual incorreta' } },
      },
    });

    await preencherTroca('errada99', 'minhaNova1');

    expect(await screen.findByRole('alert')).toHaveTextContent('Senha atual incorreta');
    expect(screen.getByRole('header', { name: TITULO })).toBeOnTheScreen();
  });

  it('a única outra saída é sair da conta', async () => {
    const { api } = await entrarComTemporaria({ 'POST /auth/logout': { status: 200, corpo: {} } });

    await fireEvent.press(screen.getByRole('button', { name: 'Sair da conta' }));

    expect(await screen.findByLabelText('Email')).toBeOnTheScreen();
    await waitFor(() => expect(api.para('POST /auth/logout')).toHaveLength(1));
    expect(api.para('POST /auth/logout')[0].corpo).toEqual({ refresh_token: 'R1' });
  });
});
