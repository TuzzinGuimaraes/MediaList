// PROTÓTIPO: rotas tipadas do TanStack Router, code-based (o mais simples para um protótipo).
// Os eixos de variante ficam na busca da raiz e se mantêm em toda navegação (retainSearchParams).
import { createRootRoute, createRoute, createRouter, Outlet, redirect, retainSearchParams } from '@tanstack/react-router';

import { lerSessao } from './api';
import { Casca } from './navegacao';
import { Detalhe } from './paginas/Detalhe';
import { Explorar } from './paginas/Explorar';
import { Inicio } from './paginas/Inicio';
import { Lista } from './paginas/Lista';
import { Entrar, ForaDoPrototipo } from './paginas/Outras';
import { BarraVariantes, type BuscaVariantes, EIXOS, useAplicarTema, validarVariantes } from './variantes';

function Raiz() {
  useAplicarTema();
  return (
    <>
      <Outlet />
      <BarraVariantes />
    </>
  );
}

const raiz = createRootRoute({
  component: Raiz,
  validateSearch: (s: Record<string, unknown>): BuscaVariantes => validarVariantes(s),
  search: { middlewares: [retainSearchParams<BuscaVariantes>(Object.keys(EIXOS) as (keyof BuscaVariantes)[])] },
});

const entrar = createRoute({ getParentRoute: () => raiz, path: '/entrar', component: Entrar });

const autenticado = createRoute({
  getParentRoute: () => raiz,
  id: 'autenticado',
  beforeLoad: () => {
    if (!lerSessao()) throw redirect({ to: '/entrar' });
  },
  component: () => (
    <Casca>
      <Outlet />
    </Casca>
  ),
});

const inicio = createRoute({ getParentRoute: () => autenticado, path: '/', component: Inicio });
const explorar = createRoute({
  getParentRoute: () => autenticado,
  path: '/explorar',
  validateSearch: (s: Record<string, unknown>): { busca?: string } => (typeof s.busca === 'string' && s.busca ? { busca: s.busca } : {}),
  component: Explorar,
});
const lista = createRoute({ getParentRoute: () => autenticado, path: '/lista', component: Lista });
const midia = createRoute({ getParentRoute: () => autenticado, path: '/midia/$id', component: Detalhe });
const noticias = createRoute({ getParentRoute: () => autenticado, path: '/noticias', component: () => <ForaDoPrototipo titulo="Notícias" /> });
const admin = createRoute({ getParentRoute: () => autenticado, path: '/admin', component: () => <ForaDoPrototipo titulo="Administração" /> });
const perfil = createRoute({ getParentRoute: () => autenticado, path: '/perfil', component: () => <ForaDoPrototipo titulo="Perfil e estatísticas" /> });

const arvore = raiz.addChildren([entrar, autenticado.addChildren([inicio, explorar, lista, midia, noticias, admin, perfil])]);

export const router = createRouter({ routeTree: arvore, scrollRestoration: true });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
