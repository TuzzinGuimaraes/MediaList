import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { RouterProvider, type RouterHistory } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import { ErroApi } from '../api/erros';
import { CatalogoProvider } from '../catalogo/CatalogoContext';
import { Carregando, ErroTela } from '../componentes/Estados';
import { SessaoProvider, useSessao } from '../sessao/SessaoContext';
import { TemaProvider } from '../tema/TemaContext';
import { criarRoteador } from './rotas';

function criarQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Erro 4xx é resposta, não falha passageira: só rede e 5xx tentam de novo, uma vez.
        retry: (falhas, erro) => !(erro instanceof ErroApi && erro.status < 500) && falhas < 1,
      },
    },
  });
}

/** Monta as rotas quando a sessão guardada já foi resolvida; reavalia as guardas a cada troca. */
function Roteamento({ historico }: { historico?: RouterHistory }) {
  const { estado: sessao, sessaoAtual, tentarDeNovo } = useSessao();
  const queryClient = useQueryClient();
  const [router] = useState(() => criarRoteador({ sessaoAtual, queryClient }, historico));

  // Só com a sessão resolvida: enquanto carrega, as guardas mandariam ao login à toa.
  const resolvida = sessao.estado === 'anonima' || sessao.estado === 'autenticada';
  useEffect(() => {
    if (resolvida) void router.invalidate();
  }, [router, sessao, resolvida]);

  if (sessao.estado === 'carregando') return <Carregando telaCheia rotulo="Abrindo o MediaList" />;
  if (sessao.estado === 'indisponivel') return <ErroTela telaCheia erro={sessao.erro} tentarDeNovo={() => void tentarDeNovo()} />;
  return <RouterProvider router={router} />;
}

/** O web inteiro. `historico` é para os testes (memória); no navegador, o do browser. */
export function App({ historico }: { historico?: RouterHistory }) {
  const [queryClient] = useState(criarQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <TemaProvider>
        <CatalogoProvider>
          <SessaoProvider>
            <Roteamento historico={historico} />
          </SessaoProvider>
        </CatalogoProvider>
      </TemaProvider>
    </QueryClientProvider>
  );
}
