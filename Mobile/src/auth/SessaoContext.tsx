import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { type Cliente, type Tokens, criarCliente } from '../api/cliente';
import { urlApi } from '../api/config';
import type { DadosRegistro, RespostaLogin, RespostaRefresh, UsuarioSessao } from '../api/tipos';
import { apagarSessao, carregarSessao, guardarSessao, guardarTokens, guardarTrocaDeSenha } from './armazenamento';

type EstadoSessao =
  | { estado: 'carregando' }
  | { estado: 'anonima' }
  | { estado: 'autenticada'; usuario: UsuarioSessao }
  /** Entrou com uma Senha temporária (CONTEXT.md): só sai trocando a senha ou saindo da conta. */
  | { estado: 'troca_de_senha'; usuario: UsuarioSessao };

type ValorSessao = {
  sessao: EstadoSessao;
  cliente: Cliente;
  entrar(email: string, senha: string): Promise<void>;
  registrar(dados: DadosRegistro): Promise<void>;
  /** Troca a senha e segue autenticado com o par novo, sem a troca pendente. */
  trocarSenha(senhaAtual: string, novaSenha: string): Promise<void>;
  /** A API indicou a Senha temporária pendente (`deve_trocar_senha` do /auth/me ou o 403). */
  trocaObrigatoria(): void;
  sair(): Promise<void>;
};

const SessaoContext = createContext<ValorSessao | null>(null);

export function SessaoProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [sessao, setSessao] = useState<EstadoSessao>({ estado: 'carregando' });
  // Os tokens vivem fora do estado do React: o cliente HTTP os lê a cada requisição.
  const [{ cliente, definirTokens, encerrar, trocaObrigatoria }] = useState(() => {
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
    const trocaObrigatoria = () => {
      if (!tokens || encerramento) return;
      void guardarTrocaDeSenha(true);
      setSessao((s) => (s.estado === 'autenticada' ? { estado: 'troca_de_senha', usuario: s.usuario } : s));
    };
    const cliente = criarCliente(urlApi(), {
      atuais: () => tokens,
      renovados: async (novos) => {
        definirTokens(novos);
        await guardarTokens(novos);
      },
      expirada: async () => {
        if (tokens || encerramento) await encerrar();
      },
      trocaObrigatoria,
    });
    return { cliente, definirTokens, encerrar, trocaObrigatoria };
  });

  useEffect(() => {
    let ativo = true;
    carregarSessao().then((guardada) => {
      if (!ativo) return;
      definirTokens(guardada?.tokens ?? null);
      if (!guardada) return setSessao({ estado: 'anonima' });
      setSessao({ estado: guardada.trocaDeSenha ? 'troca_de_senha' : 'autenticada', usuario: guardada.usuario });
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
      const trocaDeSenha = resposta.deve_trocar_senha;
      await guardarSessao({ tokens: novos, usuario: resposta.usuario, trocaDeSenha });
      definirTokens(novos);
      setSessao({ estado: trocaDeSenha ? 'troca_de_senha' : 'autenticada', usuario: resposta.usuario });
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

  const trocarSenha = useCallback(
    async (senhaAtual: string, novaSenha: string) => {
      const resposta = await cliente.requisitar<RespostaRefresh>('/auth/trocar-senha', {
        metodo: 'POST',
        corpo: { senha_atual: senhaAtual, nova_senha: novaSenha },
      });
      const novos = { access: resposta.access_token, refresh: resposta.refresh_token };
      // Os tokens antes da flag: se o app morrer no meio, sobra o par novo com a tela de troca.
      await guardarTokens(novos);
      definirTokens(novos);
      await guardarTrocaDeSenha(false);
      setSessao((s) => (s.estado === 'troca_de_senha' ? { estado: 'autenticada', usuario: s.usuario } : s));
    },
    [cliente, definirTokens],
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
    () => ({ sessao, cliente, entrar, registrar, trocarSenha, trocaObrigatoria, sair }),
    [sessao, cliente, entrar, registrar, trocarSenha, trocaObrigatoria, sair],
  );

  return <SessaoContext.Provider value={valor}>{children}</SessaoContext.Provider>;
}

export function useSessao(): ValorSessao {
  const valor = useContext(SessaoContext);
  if (!valor) throw new Error('useSessao fora do SessaoProvider');
  return valor;
}
