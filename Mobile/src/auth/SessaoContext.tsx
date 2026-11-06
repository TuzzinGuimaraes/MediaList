import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { type Cliente, type Tokens, criarCliente } from '../api/cliente';
import { urlApi } from '../api/config';
import type { DadosRegistro, RespostaLogin, UsuarioSessao } from '../api/tipos';
import { apagarSessao, carregarSessao, guardarSessao } from './armazenamento';

type EstadoSessao =
  | { estado: 'carregando' }
  | { estado: 'anonima' }
  | { estado: 'autenticada'; usuario: UsuarioSessao };

type ValorSessao = {
  sessao: EstadoSessao;
  cliente: Cliente;
  entrar(email: string, senha: string): Promise<void>;
  registrar(dados: DadosRegistro): Promise<void>;
  sair(): Promise<void>;
};

const SessaoContext = createContext<ValorSessao | null>(null);

export function SessaoProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [sessao, setSessao] = useState<EstadoSessao>({ estado: 'carregando' });
  // Os tokens vivem fora do estado do React: o cliente HTTP os lê a cada requisição.
  const [{ cliente, definirTokens }] = useState(() => {
    let tokens: Tokens | null = null;
    return {
      cliente: criarCliente(urlApi(), { atuais: () => tokens }),
      definirTokens: (novos: Tokens | null) => {
        tokens = novos;
      },
    };
  });

  useEffect(() => {
    let ativo = true;
    carregarSessao().then((guardada) => {
      if (!ativo) return;
      definirTokens(guardada?.tokens ?? null);
      setSessao(guardada ? { estado: 'autenticada', usuario: guardada.usuario } : { estado: 'anonima' });
    });
    return () => {
      ativo = false;
    };
  }, [definirTokens]);

  const entrar = useCallback(
    async (email: string, senha: string) => {
      const resposta = await cliente.requisitar<RespostaLogin>('/auth/login', {
        metodo: 'POST',
        corpo: { email, senha },
      });
      const novos = { access: resposta.access_token, refresh: resposta.refresh_token };
      await guardarSessao({ tokens: novos, usuario: resposta.usuario });
      definirTokens(novos);
      setSessao({ estado: 'autenticada', usuario: resposta.usuario });
    },
    [cliente, definirTokens],
  );

  const registrar = useCallback(
    async (dados: DadosRegistro) => {
      await cliente.requisitar('/auth/registro', { metodo: 'POST', corpo: dados });
      await entrar(dados.email, dados.senha);
    },
    [cliente, entrar],
  );

  const sair = useCallback(async () => {
    definirTokens(null);
    await apagarSessao();
    queryClient.clear();
    setSessao({ estado: 'anonima' });
  }, [queryClient, definirTokens]);

  const valor = useMemo(
    () => ({ sessao, cliente, entrar, registrar, sair }),
    [sessao, cliente, entrar, registrar, sair],
  );

  return <SessaoContext.Provider value={valor}>{children}</SessaoContext.Provider>;
}

export function useSessao(): ValorSessao {
  const valor = useContext(SessaoContext);
  if (!valor) throw new Error('useSessao fora do SessaoProvider');
  return valor;
}
