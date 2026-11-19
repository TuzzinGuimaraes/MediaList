// Sessão autenticada do web (ADR 0006), fora do React: access em memória, refresh rotativo
// guardado (ver armazenamento.ts), logout que revoga os dois. "Sessão" aqui é só
// autenticação; o catálogo que a tela mostra é o CatalogoContext.
import type { QueryClient } from '@tanstack/react-query';

import { type Api, criarCliente, exigir } from '../api/cliente';
import type { Esquemas, UsuarioDaSessao } from '../api/tipos';
import { descartarSessaoAntiga, guardarRefresh, lerRefresh } from './armazenamento';

export type EstadoSessao =
  | { estado: 'carregando' }
  | { estado: 'anonima' }
  /** Havia sessão guardada, mas a API não respondeu ao renová-la: o refresh fica para tentar de novo. */
  | { estado: 'indisponivel'; erro: unknown }
  | { estado: 'autenticada'; usuario: UsuarioDaSessao };

export type Sessao = ReturnType<typeof criarSessao>;

export function criarSessao(queryClient: QueryClient) {
  descartarSessaoAntiga();
  let estado: EstadoSessao = lerRefresh() ? { estado: 'carregando' } : { estado: 'anonima' };
  const ouvintes = new Set<() => void>();
  const mudar = (novo: EstadoSessao) => {
    estado = novo;
    for (const ouvinte of ouvintes) ouvinte();
  };

  // O access vive só aqui: o cliente o lê a cada requisição.
  let access: string | null = null;

  /** Encerramento local: apaga tokens e cache. Não chama o servidor. */
  function encerrar() {
    access = null;
    guardarRefresh(null);
    queryClient.clear();
    mudar({ estado: 'anonima' });
  }

  const api: Api = criarCliente({
    access: () => access,
    refresh: lerRefresh,
    renovados: (novos) => {
      access = novos.access;
      guardarRefresh(novos.refresh);
    },
    expirada: () => {
      if (estado.estado === 'autenticada') encerrar();
    },
  });

  let restauracao: Promise<void> | null = null;

  /** Reabre a sessão guardada: renova o refresh e busca o Usuário e o Nível de acesso. */
  function restaurar(): Promise<void> {
    restauracao ??= (async () => {
      mudar({ estado: 'carregando' });
      try {
        if (!(await api.renovar())) {
          guardarRefresh(null);
          mudar({ estado: 'anonima' });
          return;
        }
        const [{ usuario }, { permissoes }] = await Promise.all([
          exigir(api.GET('/api/auth/me')),
          exigir(api.GET('/api/usuario/permissoes')),
        ]);
        mudar({
          estado: 'autenticada',
          usuario: { id: usuario.id_usuario, nome: usuario.nome_completo, email: usuario.email, permissoes },
        });
      } catch (erro) {
        mudar({ estado: 'indisponivel', erro });
      }
    })().finally(() => {
      restauracao = null;
    });
    return restauracao;
  }

  async function entrar(email: string, senha: string): Promise<void> {
    const resposta = await exigir(api.POST('/api/auth/login', { body: { email, senha } }));
    access = resposta.access_token;
    // Sem refresh (banco sem a tabela), a sessão vale enquanto a aba estiver aberta.
    guardarRefresh(resposta.refresh_token);
    mudar({ estado: 'autenticada', usuario: resposta.usuario });
  }

  async function registrar(dados: Esquemas['CorpoRegistro']): Promise<void> {
    await exigir(api.POST('/api/auth/registro', { body: dados }));
    await entrar(dados.email, dados.senha);
  }

  async function sair(): Promise<void> {
    // Revoga o access (blocklist) e o refresh desta sessão. O corpo leva o refresh vigente:
    // se o access expirou, renova e repete com o refresh novo, senão o sucessor ficaria vivo.
    // Falhar (sem rede, API fora) não impede sair: o local é apagado de qualquer jeito.
    const revogar = () => api.POST('/api/auth/logout', { body: { refresh_token: lerRefresh() } });
    try {
      const { response } = await revogar();
      if (response.status === 401 && (await api.renovar())) await revogar();
    } catch {
      // Segue para o encerramento local.
    }
    encerrar();
  }

  /** Outra aba saiu (o refresh sumiu do armazenamento): esta também sai, sem chamar o servidor. */
  function refreshSumiu() {
    if (estado.estado === 'autenticada') encerrar();
  }

  return {
    api,
    estado: () => estado,
    assinar(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => void ouvintes.delete(ouvinte);
    },
    restaurar,
    entrar,
    registrar,
    sair,
    refreshSumiu,
  };
}

export function ehAdmin(usuario: UsuarioDaSessao): boolean {
  return usuario.permissoes.nivel_acesso === 'admin';
}
