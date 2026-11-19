// Rotas tipadas (TanStack Router, code-based). Todas as telas existem desde o esqueleto;
// as provisórias são trocadas pelos tickets 04 a 08 da spec web-novo.
import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
  type RouterHistory,
} from '@tanstack/react-router';

import { Casca } from '../layout/Casca';
import { Entrar } from '../paginas/Entrar';
import { Explorar } from '../paginas/explorar/Explorar';
import { validarBuscaExplorar } from '../paginas/explorar/busca';
import { Admin, Detalhe, Inicio, Lista, NaoEncontrada, Noticias, Perfil } from '../paginas/Provisorias';
import { Registro } from '../paginas/Registro';
import { ehAdmin, type EstadoSessao } from '../sessao/sessao';

export type ContextoRotas = {
  /** Leitura síncrona da sessão para as guardas. */
  sessaoAtual(): EstadoSessao;
  queryClient: QueryClient;
};

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof criarRoteador>;
  }
  interface StaticDataRouteOption {
    /** A tela abre com um destaque no topo: a nav fica translúcida sobre ele. */
    destaque?: boolean;
  }
}

type BuscaAcesso = { redirecionar?: string };
const validarAcesso = (s: Record<string, unknown>): BuscaAcesso =>
  typeof s.redirecionar === 'string' ? { redirecionar: s.redirecionar } : {};

const raiz = createRootRouteWithContext<ContextoRotas>()({
  component: Outlet,
  notFoundComponent: NaoEncontrada,
});

/** Quem já está logado não vê Entrar nem Criar conta. */
function soAnonimo({ context }: { context: ContextoRotas }) {
  if (context.sessaoAtual().estado === 'autenticada') throw redirect({ to: '/' });
}

const entrar = createRoute({
  getParentRoute: () => raiz,
  path: '/entrar',
  validateSearch: validarAcesso,
  beforeLoad: soAnonimo,
  component: Entrar,
});

const registro = createRoute({
  getParentRoute: () => raiz,
  path: '/registro',
  validateSearch: validarAcesso,
  beforeLoad: soAnonimo,
  component: Registro,
});

/** Guarda de autenticação: sem sessão, vai ao login e volta para cá depois. */
const autenticado = createRoute({
  getParentRoute: () => raiz,
  id: 'autenticado',
  beforeLoad: ({ context, location }) => {
    if (context.sessaoAtual().estado !== 'autenticada') {
      throw redirect({ to: '/entrar', search: { redirecionar: location.href } });
    }
  },
  component: Casca,
});

const inicio = createRoute({
  getParentRoute: () => autenticado,
  path: '/',
  staticData: { destaque: true },
  component: Inicio,
});

const explorar = createRoute({
  getParentRoute: () => autenticado,
  path: '/explorar',
  validateSearch: validarBuscaExplorar,
  component: Explorar,
});

const lista = createRoute({ getParentRoute: () => autenticado, path: '/lista', component: Lista });

const midia = createRoute({
  getParentRoute: () => autenticado,
  path: '/midia/$id',
  staticData: { destaque: true },
  component: Detalhe,
});

const noticias = createRoute({ getParentRoute: () => autenticado, path: '/noticias', component: Noticias });
const perfil = createRoute({ getParentRoute: () => autenticado, path: '/perfil', component: Perfil });

/** Guarda de admin (`nivel_acesso`, ADR 0012): quem não é admin volta ao Início. */
const admin = createRoute({
  getParentRoute: () => autenticado,
  path: '/admin',
  beforeLoad: ({ context }) => {
    const sessao = context.sessaoAtual();
    if (sessao.estado !== 'autenticada' || !ehAdmin(sessao.usuario)) throw redirect({ to: '/' });
  },
  component: Admin,
});

const arvore = raiz.addChildren([
  entrar,
  registro,
  autenticado.addChildren([inicio, explorar, lista, midia, noticias, perfil, admin]),
]);

export function criarRoteador(contexto: ContextoRotas, historico?: RouterHistory) {
  return createRouter({
    routeTree: arvore,
    context: contexto,
    history: historico,
    scrollRestoration: true,
    defaultPreload: 'intent',
  });
}
