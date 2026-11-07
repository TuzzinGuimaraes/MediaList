import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { type Cliente, type Tokens, criarCliente } from '../api/cliente';
import { urlApi } from '../api/config';
import type { DadosRegistro, RespostaLogin, UsuarioSessao } from '../api/tipos';
import { apagarSessao, carregarSessao, guardarSessao, guardarTokens } from './armazenamento';

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
  const [{ cliente, definirTokens, encerrar }] = useState(() => {
    let tokens: Tokens | null = null;
    const definirTokens = (novos: Tokens | null) => {
      tokens = novos;
    };
    // Várias requisições podem descobrir a expiração juntas: todas esperam o mesmo
    // encerramento, e quem chega depois dele, com a sessão já limpa, não refaz nada.
    let encerramento: Promise<void> | null = null;
    const encerrar = () =>
      (encerramento ??= (async () => {
        definirTokens(null);
        await apagarSessao();
        queryClient.clear();
        setSessao({ estado: 'anonima' });
      })().finally(() => {
        encerramento = null;
      }));
    const cliente = criarCliente(urlApi(), {
      atuais: () => tokens,
      renovados: async (novos) => {
        definirTokens(novos);
        await guardarTokens(novos);
      },
      expirada: async () => {
        if (tokens || encerramento) await encerrar();
      },
    });
    return { cliente, definirTokens, encerrar };
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
    // Revoga no servidor o refresh deste aparelho. Falhar aqui (sem rede, token já
    // inválido) não impede sair: os tokens locais são apagados de qualquer jeito.
    await cliente
      .requisitar('/auth/logout', {
        metodo: 'POST',
        corpo: (atuais) => (atuais?.refresh ? { refresh_token: atuais.refresh } : undefined),
      })
      .catch(() => undefined);
    await encerrar();
  }, [cliente, encerrar]);

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
