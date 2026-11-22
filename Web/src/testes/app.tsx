// Helper de login dos testes de tela. Monta o app inteiro (provedores, rotas, casca) com
// histórico em memória e o fetch simulado. Dois caminhos:
// - `abrirLogado(url)`: há uma sessão aberta (como ao reabrir o navegador); o app renova
//   a sessão sozinho e abre direto em `url`;
// - `entrarPeloLogin(url)`: abre sem sessão e passa pela tela de login.
// As rotas de sessão (login, refresh, me, permissões, logout) e as Notificações do sino já
// vêm prontas; `rotas` acrescenta as da tela testada ou troca alguma delas.
import { createMemoryHistory } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Esquemas, UsuarioDaSessao } from '../api/tipos';
import { App } from '../app/App';
import { marcarConectado } from '../sessao/armazenamento';
import { type Resposta, type Rotas, simularFetch } from './fetchSimulado';

export const usuarioAna: UsuarioDaSessao = {
  id: 'USR-ana',
  nome: 'Ana Souza',
  email: 'ana@exemplo.com',
  permissoes: { nivel_acesso: 'usuario' },
};

export const adminBia: UsuarioDaSessao = {
  id: 'USR-bia',
  nome: 'Bia Admin',
  email: 'bia@exemplo.com',
  permissoes: { nivel_acesso: 'admin' },
};

/** Login do web: o refresh vai no cookie (que o teste não vê), e o corpo leva `refresh_token: null`. */
export function loginOk(usuario: UsuarioDaSessao = usuarioAna, access = 'A1'): Resposta {
  const corpo: Esquemas['RespostaLogin'] = { access_token: access, refresh_token: null, usuario, deve_trocar_senha: false };
  return { status: 200, corpo };
}

/** Rotas da sessão do `usuario`: o login devolve o access A1 e o refresh, o A2. */
export function rotasDaSessao(usuario: UsuarioDaSessao = usuarioAna): Rotas {
  const me: Esquemas['RespostaMe'] = {
    usuario: { id_usuario: usuario.id, nome_completo: usuario.nome, email: usuario.email, foto_perfil: null },
    deve_trocar_senha: false,
  };
  const permissoes: Esquemas['RespostaPermissoes'] = { permissoes: usuario.permissoes };
  return {
    'POST /auth/login': loginOk(usuario),
    'POST /auth/refresh': { status: 200, corpo: { access_token: 'A2', refresh_token: null } },
    'GET /auth/me': { status: 200, corpo: me },
    'GET /usuario/permissoes': { status: 200, corpo: permissoes },
    'POST /auth/logout': { status: 200, corpo: { mensagem: 'Logout realizado com sucesso' } },
    // O sino da nav busca as Notificações em toda tela autenticada.
    'GET /notificacoes': { status: 200, corpo: { notificacoes: [] } },
  };
}

type Opcoes = { usuario?: UsuarioDaSessao; rotas?: Rotas };

/** Monta o app em `url`, sem esperar nada. */
export function abrirApp(url = '/', { usuario, rotas = {} }: Opcoes = {}) {
  const api = simularFetch({ ...rotasDaSessao(usuario), ...rotas });
  const user = userEvent.setup();
  const historico = createMemoryHistory({ initialEntries: [url] });
  const tela = render(<App historico={historico} />);
  return { api, user, historico, tela };
}

/** Navegação principal da casca: aparece quando a sessão está pronta e a rota é autenticada. */
export function navPrincipal() {
  return screen.findByRole('navigation', { name: 'Principal' });
}

/** Abre o app em `url` com a marca de sessão (o cookie do refresh existe) e espera a casca autenticada. */
export async function abrirLogado(url = '/', opcoes: Opcoes = {}) {
  marcarConectado(true);
  const aberto = abrirApp(url, opcoes);
  await navPrincipal();
  return aberto;
}

/** Preenche a tela de login e clica em Entrar. */
export async function preencherLogin(user: ReturnType<typeof userEvent.setup>, email: string, senha: string) {
  await user.type(await screen.findByLabelText('Email'), email);
  await user.type(screen.getByLabelText('Senha'), senha);
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
}

/** Abre o app sem sessão em `url`, entra pelo login e espera a casca. */
export async function entrarPeloLogin(url = '/', opcoes: Opcoes = {}) {
  const aberto = abrirApp(url, opcoes);
  await preencherLogin(aberto.user, opcoes.usuario?.email ?? usuarioAna.email, 'segredo1');
  await navPrincipal();
  return aberto;
}
