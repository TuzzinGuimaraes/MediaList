import { useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, useContext, useEffect, useState, useSyncExternalStore } from 'react';

import type { Api } from '../api/cliente';
import type { UsuarioDaSessao } from '../api/tipos';
import { CHAVE_CONECTADO } from './armazenamento';
import { criarSessao, type EstadoSessao, type Sessao } from './sessao';

const SessaoContext = createContext<Sessao | null>(null);

export function SessaoProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [sessao] = useState(() => criarSessao(queryClient));

  useEffect(() => {
    // O efeito duplo do StrictMode cai na mesma restauração, sem gastar o refresh duas vezes.
    if (sessao.estado().estado === 'carregando') void sessao.restaurar();
  }, [sessao]);

  useEffect(() => {
    const ouvir = (e: StorageEvent) => {
      if (e.key === null || (e.key === CHAVE_CONECTADO && e.newValue === null)) sessao.outraAbaSaiu();
    };
    window.addEventListener('storage', ouvir);
    return () => window.removeEventListener('storage', ouvir);
  }, [sessao]);

  return <SessaoContext.Provider value={sessao}>{children}</SessaoContext.Provider>;
}

function useSessaoBruta(): Sessao {
  const sessao = useContext(SessaoContext);
  if (!sessao) throw new Error('useSessao fora do SessaoProvider');
  return sessao;
}

/** Estado reativo da sessão e as ações. `sessaoAtual` é a leitura síncrona, para as guardas das rotas. */
export function useSessao() {
  const sessao = useSessaoBruta();
  const estado: EstadoSessao = useSyncExternalStore(sessao.assinar, sessao.estado);
  return {
    estado,
    sessaoAtual: sessao.estado,
    entrar: sessao.entrar,
    registrar: sessao.registrar,
    trocarSenha: sessao.trocarSenha,
    sair: sessao.sair,
    tentarDeNovo: sessao.restaurar,
  };
}

/** Cliente da API autenticado, para as consultas das telas. */
export function useApi(): Api {
  return useSessaoBruta().api;
}

/** Usuário logado; só nas telas sob a guarda de autenticação. */
export function useUsuario(): UsuarioDaSessao {
  const { estado } = useSessao();
  if (estado.estado !== 'autenticada') throw new Error('useUsuario fora de uma rota autenticada');
  return estado.usuario;
}
