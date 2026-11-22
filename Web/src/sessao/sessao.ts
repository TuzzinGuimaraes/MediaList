// Sessão autenticada do web (ADR 0006), fora do React: access em memória, refresh rotativo
// no cookie httpOnly (ver armazenamento.ts), logout que revoga os dois. "Sessão" aqui é só
// autenticação; o catálogo que a tela mostra é o CatalogoContext.
import type { QueryClient } from '@tanstack/react-query';

import { type Api, criarCliente, exigir } from '../api/cliente';
import type { Esquemas, UsuarioDaSessao } from '../api/tipos';
import { descartarSessaoAntiga, estaConectado, marcarConectado } from './armazenamento';

export type EstadoSessao =
  | { estado: 'carregando' }
  | { estado: 'anonima' }
  /** Havia sessão aberta, mas a API não respondeu ao renová-la: o refresh fica para tentar de novo. */
  | { estado: 'indisponivel'; erro: unknown }
  | { estado: 'autenticada'; usuario: UsuarioDaSessao }
  /** Entrou com uma Senha temporária: só sai trocando a senha ou saindo da conta. */
  | { estado: 'troca_de_senha'; nome: string };

export type Sessao = ReturnType<typeof criarSessao>;

export function criarSessao(queryClient: QueryClient) {
  descartarSessaoAntiga();
  let estado: EstadoSessao = estaConectado() ? { estado: 'carregando' } : { estado: 'anonima' };
  const ouvintes = new Set<() => void>();
  const mudar = (novo: EstadoSessao) => {
    estado = novo;
    for (const ouvinte of ouvintes) ouvinte();
  };

  // O access vive só aqui: o cliente o lê a cada requisição.
  let access: string | null = null;

  /** Encerramento local: apaga o access, a marca e o cache. Não chama o servidor. */
  function encerrar() {
    access = null;
    marcarConectado(false);
    queryClient.clear();
    mudar({ estado: 'anonima' });
  }

  const api: Api = criarCliente({
    access: () => access,
    renovado: (novo) => {
      access = novo;
    },
    expirada: () => {
      if (comSessao()) encerrar();
    },
    trocaObrigatoria: () => {
      if (estado.estado !== 'autenticada') return;
      queryClient.clear();
      mudar({ estado: 'troca_de_senha', nome: estado.usuario.nome });
    },
  });

  function comSessao() {
    return estado.estado === 'autenticada' || estado.estado === 'troca_de_senha';
  }

  /** O Usuário do access vigente; com a troca pendente, nem pede as permissões (a API responderia 403). */
  async function carregarUsuario(): Promise<void> {
    const { usuario, deve_trocar_senha } = await exigir(api.GET('/api/auth/me'));
    if (deve_trocar_senha) {
      mudar({ estado: 'troca_de_senha', nome: usuario.nome_completo });
      return;
    }
    const { permissoes } = await exigir(api.GET('/api/usuario/permissoes'));
    mudar({
      estado: 'autenticada',
      usuario: { id: usuario.id_usuario, nome: usuario.nome_completo, email: usuario.email, permissoes },
    });
  }

  let restauracao: Promise<void> | null = null;

  /** Reabre a sessão guardada: renova o refresh e busca o Usuário e o Nível de acesso. */
  function restaurar(): Promise<void> {
    restauracao ??= (async () => {
      mudar({ estado: 'carregando' });
      try {
        if (!(await api.renovar())) {
          marcarConectado(false);
          mudar({ estado: 'anonima' });
          return;
        }
        await carregarUsuario();
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
    // O refresh veio no cookie. Sem ele (banco sem a tabela), o próximo refresh falha e a
    // sessão vale enquanto a aba estiver aberta.
    marcarConectado(true);
    mudar(
      resposta.deve_trocar_senha
        ? { estado: 'troca_de_senha', nome: resposta.usuario.nome }
        : { estado: 'autenticada', usuario: resposta.usuario },
    );
  }

  /** Troca a senha (a temporária ou não) e segue com o access novo, sem a troca pendente. */
  async function trocarSenha(senhaAtual: string, novaSenha: string): Promise<void> {
    const resposta = await exigir(
      api.POST('/api/auth/trocar-senha', { body: { senha_atual: senhaAtual, nova_senha: novaSenha } }),
    );
    access = resposta.access_token;
    try {
      await carregarUsuario();
    } catch (erro) {
      // A senha já mudou: "Tentar de novo" reabre a sessão pelo refresh novo do cookie.
      mudar({ estado: 'indisponivel', erro });
    }
  }

  async function registrar(dados: Esquemas['CorpoRegistro']): Promise<void> {
    await exigir(api.POST('/api/auth/registro', { body: dados }));
    await entrar(dados.email, dados.senha);
  }

  async function sair(): Promise<void> {
    // Revoga o access (blocklist) e o refresh do cookie, que o backend apaga. Se o access
    // expirou, renova e repete: o logout exige um access válido.
    // Falhar (sem rede, API fora) não impede sair: o local é apagado de qualquer jeito.
    const revogar = () => api.POST('/api/auth/logout', { body: {} });
    try {
      const { response } = await revogar();
      if (response.status === 401 && (await api.renovar())) await revogar();
    } catch {
      // Segue para o encerramento local.
    }
    encerrar();
  }

  /** Outra aba saiu (a marca sumiu do armazenamento): esta também sai, sem chamar o servidor. */
  function outraAbaSaiu() {
    if (comSessao()) encerrar();
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
    trocarSenha,
    sair,
    outraAbaSaiu,
  };
}

export function ehAdmin(usuario: UsuarioDaSessao): boolean {
  return usuario.permissoes.nivel_acesso === 'admin';
}
