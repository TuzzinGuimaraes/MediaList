// PROTÓTIPO DESCARTÁVEL do web novo (ticket 19, Q68): variantes de layout de desktop numa
// barra flutuante (só em dev). Não é código de produção: sem testes, erro mínimo.
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/600.css';
import '@fontsource/outfit/700.css';
import './estilo.css';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { ProvedorCatalogo } from './catalogo';
import { router } from './rotas';

const consultas = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 60_000, refetchOnWindowFocus: false } } });

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <QueryClientProvider client={consultas}>
      <ProvedorCatalogo>
        <RouterProvider router={router} />
      </ProvedorCatalogo>
    </QueryClientProvider>
  </StrictMode>,
);
