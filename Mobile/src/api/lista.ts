import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { useSessao } from '../auth/SessaoContext';
import { aplicarProgresso, type DadosItem, totalDoItem } from '../dominio/itemLista';
import type { RespostaLista } from './tipos';

// As rotas de escrita (Backend/routes/lista.py) só respondem `{mensagem}` (e `id_lista`
// no POST): o Item gravado, inclusive a promoção a Concluído, vem do GET /lista refeito.

const CHAVE = ['lista'] as const;
const CHAVE_PROGRESSO = ['lista', 'progresso'] as const;

function useConsultaLista() {
  const { cliente, sessao } = useSessao();
  return {
    queryKey: CHAVE,
    queryFn: () => cliente.requisitar<RespostaLista>('/lista'),
    enabled: sessao.estado === 'autenticada',
  };
}

/** Itens da Lista pessoal, mais recentes primeiro (ordem da API). */
export function useLista() {
  return useQuery({ ...useConsultaLista(), select: (r: RespostaLista) => r.lista });
}

/** O Item de lista do Usuário para esta Mídia, ou null se ela não está na Lista pessoal. */
export function useItemDaLista(id: string) {
  return useQuery({
    ...useConsultaLista(),
    select: (r: RespostaLista) => r.lista.find((item) => item.id_midia === id) ?? null,
  });
}

/**
 * Refaz tudo o que deriva da Lista: ['lista'] (também lida pelas estatísticas do Perfil);
 * os totais do Perfil e a distribuição por Estado no detalhe também mudam.
 */
function useInvalidarLista() {
  const queryClient = useQueryClient();
  return (idMidia?: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: CHAVE }),
      queryClient.invalidateQueries({ queryKey: ['usuario', 'estatisticas'] }),
      idMidia ? queryClient.invalidateQueries({ queryKey: ['midias', idMidia, 'distribuicao'] }) : null,
    ]);
}

/** Cria o Item (POST /lista/adicionar) ou grava o existente (PUT /lista/<id_lista>). */
export function useSalvarItem() {
  const { cliente } = useSessao();
  const invalidar = useInvalidarLista();
  return useMutation({
    mutationFn: ({ idMidia, idLista, dados }: { idMidia: string; idLista?: string; dados: DadosItem }) =>
      idLista
        ? cliente.requisitar(`/lista/${encodeURIComponent(idLista)}`, { metodo: 'PUT', corpo: dados })
        : cliente.requisitar('/lista/adicionar', { metodo: 'POST', corpo: { id_midia: idMidia, ...dados } }),
    onSuccess: (_r, { idMidia }) => invalidar(idMidia),
  });
}

export function useRemoverItem() {
  const { cliente } = useSessao();
  const invalidar = useInvalidarLista();
  return useMutation({
    mutationFn: ({ idLista }: { idMidia: string; idLista: string }) =>
      cliente.requisitar(`/lista/${encodeURIComponent(idLista)}`, { metodo: 'DELETE' }),
    onSuccess: (_r, { idMidia }) => invalidar(idMidia),
  });
}

/** "2026-11-06" no fuso do aparelho. */
function hoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type ItemCache = RespostaLista['lista'][number];

/** Estado de uma sequência de toques no stepper de um Item, enquanto houver toque pendente. */
type Rajada = {
  /** O Item como estava no cache antes do primeiro toque. */
  original: ItemCache;
  /** Soma dos passos que não falharam (pendentes ou confirmados): o que a tela mostra. */
  aplicado: number;
  /** Último Progresso que o servidor aceitou: base do próximo envio. */
  confirmado: number;
};

function comProgresso(original: ItemCache, progresso: number): ItemCache {
  return {
    ...original,
    ...aplicarProgresso({ ...original, data_conclusao: original.data_conclusao ?? null }, progresso, hoje()),
  };
}

/**
 * − / + do stepper, em passos de ±1: aplica no cache na hora (inclusive a conclusão no
 * total) e, se o servidor recusar um toque, desfaz só o passo dele, não os que deram
 * certo. Os toques vão ao servidor um por vez (mesmo `scope`), cada um sobre o último
 * valor aceito, para que um toque recusado não fique embutido no envio seguinte. Com
 * toques seguidos, só o último a terminar refaz a Lista.
 */
export function useMudarProgresso() {
  const { cliente } = useSessao();
  const queryClient = useQueryClient();
  const invalidar = useInvalidarLista();
  const rajadas = useRef(new Map<string, Rajada>()).current;

  const mostrar = (idLista: string, rajada: Rajada) =>
    queryClient.setQueryData<RespostaLista>(CHAVE, (r) =>
      r && {
        lista: r.lista.map((item) =>
          item.id_lista === idLista
            ? comProgresso(rajada.original, (rajada.original.progresso_atual ?? 0) + rajada.aplicado)
            : item,
        ),
      },
    );

  return useMutation({
    mutationKey: CHAVE_PROGRESSO,
    scope: { id: CHAVE_PROGRESSO.join('/') },
    mutationFn: async ({ idLista, passo }: { idLista: string; idMidia: string; passo: number }) => {
      const rajada = rajadas.get(idLista);
      if (!rajada) throw new Error('Item fora da Lista pessoal');
      const base = rajada.confirmado;
      const total = totalDoItem(rajada.original);
      const progresso = Math.max(0, total === null ? base + passo : Math.min(total, base + passo));
      await cliente.requisitar(`/lista/${encodeURIComponent(idLista)}/progresso`, {
        metodo: 'PUT',
        corpo: { progresso_atual: progresso },
      });
      rajada.confirmado = progresso;
    },
    onMutate: async ({ idLista, passo }) => {
      await queryClient.cancelQueries({ queryKey: CHAVE, exact: true });
      let rajada = rajadas.get(idLista);
      if (!rajada) {
        const original = queryClient.getQueryData<RespostaLista>(CHAVE)?.lista.find((i) => i.id_lista === idLista);
        if (!original) return;
        rajada = { original, aplicado: 0, confirmado: original.progresso_atual ?? 0 };
        rajadas.set(idLista, rajada);
      }
      rajada.aplicado += passo;
      mostrar(idLista, rajada);
    },
    onError: (_e, { idLista, passo }) => {
      const rajada = rajadas.get(idLista);
      if (!rajada) return;
      rajada.aplicado -= passo;
      mostrar(idLista, rajada);
    },
    onSettled: (_r, _e, { idMidia }) => {
      if (queryClient.isMutating({ mutationKey: CHAVE_PROGRESSO }) === 1) {
        rajadas.clear();
        return invalidar(idMidia);
      }
    },
  });
}
