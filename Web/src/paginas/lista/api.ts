// Consultas e escritas da Lista pessoal. As rotas de escrita (Backend/routes/lista.py) só
// respondem `{mensagem}` (e `id_lista` no POST): o Item gravado, inclusive a promoção a
// Concluído, vem do GET /lista refeito.
//
// Cache: chaves.lista.toda (['lista']) guarda o RespostaLista inteiro (GET /api/lista); o
// Início, o detalhe e o Perfil leem a mesma chave (`useLista`, `useItemDaMidia`).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { diaIso } from '@dominio/datas';
import { aplicarProgresso, type DadosItem, mudancaDeStatus, totalDoItem } from '@dominio/itemLista';

import { chaves } from '../../api/chaves';
import { exigir } from '../../api/cliente';
import type { Esquemas } from '../../api/tipos';
import { useApi } from '../../sessao/SessaoContext';

export type ItemLista = Esquemas['ItemLista'];
type RespostaLista = Esquemas['RespostaLista'];

const CHAVE_LISTA = chaves.lista.toda;
const CHAVE_PROGRESSO = chaves.lista.progresso;

function useConsultaLista() {
  const api = useApi();
  return { queryKey: CHAVE_LISTA, queryFn: () => exigir(api.GET('/api/lista')) };
}

/** Itens da Lista pessoal, na ordem da API (alfabética pelo título exibido). */
export function useLista() {
  return useQuery({ ...useConsultaLista(), select: (r: RespostaLista) => r.lista });
}

/** O Item de lista do Usuário para esta Mídia, ou null se ela não está na Lista pessoal. */
export function useItemDaMidia(idMidia: string) {
  return useQuery({
    ...useConsultaLista(),
    select: (r: RespostaLista) => r.lista.find((i) => i.id_midia === idMidia) ?? null,
  });
}

/**
 * Refaz o que deriva da Lista: ['lista'], as estatísticas do Perfil e o que o detalhe da
 * Mídia mostra (distribuição por Status, atividade).
 */
function useInvalidarLista() {
  const queryClient = useQueryClient();
  return (idMidia?: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: CHAVE_LISTA }),
      queryClient.invalidateQueries({ queryKey: chaves.usuario.estatisticas }),
      idMidia ? queryClient.invalidateQueries({ queryKey: chaves.midias.detalhe(idMidia) }) : null,
    ]);
}

/** Cria o Item (POST /lista/adicionar) ou grava o existente (PUT /lista/<id_lista>). */
export function useSalvarItem() {
  const api = useApi();
  const invalidar = useInvalidarLista();
  return useMutation({
    mutationFn: ({ idMidia, idLista, dados }: { idMidia: string; idLista?: string; dados: DadosItem }) =>
      idLista
        ? exigir(api.PUT('/api/lista/{lista_id}', { params: { path: { lista_id: idLista } }, body: dados }))
        : exigir(api.POST('/api/lista/adicionar', { body: { id_midia: idMidia, ...dados } })),
    onSuccess: (_r, { idMidia }) => invalidar(idMidia),
  });
}

export function useRemoverItem() {
  const api = useApi();
  const invalidar = useInvalidarLista();
  return useMutation({
    mutationFn: ({ idLista }: { idMidia: string; idLista: string }) =>
      exigir(api.DELETE('/api/lista/{lista_id}', { params: { path: { lista_id: idLista } } })),
    onSuccess: (_r, { idMidia }) => invalidar(idMidia),
  });
}

/**
 * Troca só o Status de um Item (o menu ⋯ da Lista) com PUT /lista/<id_lista>, pelas regras
 * do editor (`mudancaDeStatus`). Aparece no cache na hora; se o servidor recusar, o Item
 * volta ao que era. A Lista refeita traz o resto (data de conclusão, Recontagem).
 */
export function useMudarStatus() {
  const api = useApi();
  const queryClient = useQueryClient();
  const invalidar = useInvalidarLista();

  const trocar = (idLista: string, novo: (item: ItemLista) => ItemLista) =>
    queryClient.setQueryData<RespostaLista>(CHAVE_LISTA, (r) =>
      r && { lista: r.lista.map((item) => (item.id_lista === idLista ? novo(item) : item)) },
    );

  return useMutation({
    mutationFn: ({ item, rotulo }: { item: ItemLista; rotulo: string }) =>
      exigir(
        api.PUT('/api/lista/{lista_id}', {
          params: { path: { lista_id: item.id_lista } },
          body: mudancaDeStatus(item, rotulo),
        }),
      ),
    onMutate: async ({ item, rotulo }) => {
      await queryClient.cancelQueries({ queryKey: CHAVE_LISTA, exact: true });
      trocar(item.id_lista, (atual) => {
        const mudanca = mudancaDeStatus(item, rotulo);
        return { ...atual, ...mudanca, status_consumo: mudanca.status_consumo as ItemLista['status_consumo'] };
      });
    },
    onError: (_e, { item }) => trocar(item.id_lista, () => item),
    onSettled: (_r, _e, { item }) => invalidar(item.id_midia),
  });
}

/** Estado de uma sequência de toques no stepper de um Item, enquanto houver toque pendente. */
type Rajada = {
  /** O Item como estava no cache antes do primeiro toque. */
  original: ItemLista;
  /** Soma dos passos que não falharam (pendentes ou confirmados): o que a tela mostra. */
  aplicado: number;
  /** Último Progresso que o servidor aceitou: base do próximo envio. */
  confirmado: number;
};

function comProgresso(original: ItemLista, progresso: number): ItemLista {
  return { ...original, ...aplicarProgresso(original, progresso, diaIso()) };
}

/**
 * − / + do stepper, em passos de ±1, como no app: aplica no cache na hora (inclusive a
 * conclusão no total, ADR 0009) e, se o servidor recusar um toque, desfaz só o passo dele.
 * Os toques vão ao servidor um por vez (mesmo `scope`), cada um sobre o último valor
 * aceito; com toques seguidos, só o último a terminar refaz a Lista.
 */
export function useMudarProgresso() {
  const api = useApi();
  const queryClient = useQueryClient();
  const invalidar = useInvalidarLista();
  const rajadas = useRef(new Map<string, Rajada>()).current;

  const mostrar = (idLista: string, rajada: Rajada) =>
    queryClient.setQueryData<RespostaLista>(CHAVE_LISTA, (r) =>
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
    mutationFn: async ({ idLista, passo }: { idLista: string; idMidia: string; passo: 1 | -1 }) => {
      const rajada = rajadas.get(idLista);
      if (!rajada) throw new Error('Item fora da Lista pessoal');
      const total = totalDoItem(rajada.original);
      const alvo = rajada.confirmado + passo;
      const progresso = Math.max(0, total === null ? alvo : Math.min(total, alvo));
      await exigir(
        api.PUT('/api/lista/{lista_id}/progresso', {
          params: { path: { lista_id: idLista } },
          body: { progresso_atual: progresso },
        }),
      );
      rajada.confirmado = progresso;
    },
    onMutate: async ({ idLista, passo }) => {
      await queryClient.cancelQueries({ queryKey: CHAVE_LISTA, exact: true });
      let rajada = rajadas.get(idLista);
      if (!rajada) {
        const original = queryClient.getQueryData<RespostaLista>(CHAVE_LISTA)?.lista.find((i) => i.id_lista === idLista);
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
