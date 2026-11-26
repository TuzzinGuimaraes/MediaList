// Consultas e escritas da Lista pessoal. As rotas de escrita (Backend/routes/lista.py) só
// respondem `{mensagem}` (e `id_lista` no POST): o Item gravado, inclusive a promoção a
// Concluído, vem do GET /lista refeito.
//
// Cache: chaves.lista.toda (['lista']) guarda o RespostaLista inteiro (GET /api/lista); o
// Início, o detalhe e o Perfil leem a mesma chave (`useLista`, `useItemDaMidia`).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { diaIso } from '@dominio/datas';
import type { TipoMidia } from '@dominio/estadoConsumo';
import { aplicarProgresso, type DadosItem, mudancaDeStatus, rotuloInicial, totalDoItem } from '@dominio/itemLista';

import { chaves } from '../../api/chaves';
import { exigir } from '../../api/cliente';
import type { Esquemas } from '../../api/tipos';
import { useApi } from '../../sessao/SessaoContext';

export type ItemLista = Esquemas['ItemLista'];
type RespostaLista = Esquemas['RespostaLista'];

const CHAVE_LISTA = chaves.lista.toda;

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

/**
 * Põe a Mídia na Lista em Planejado num toque (o botão da Temporada): POST /lista/adicionar só
 * com o rótulo de Planejado do Tipo; o resto do Item fica com os padrões do servidor.
 */
export function usePorEmPlanejado() {
  const api = useApi();
  const invalidar = useInvalidarLista();
  return useMutation({
    mutationFn: ({ idMidia, tipo }: { idMidia: string; tipo: TipoMidia }) =>
      exigir(api.POST('/api/lista/adicionar', { body: { id_midia: idMidia, status_consumo: rotuloInicial(tipo) } })),
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
 * Escrita otimista de um Item da Lista: `mostrar` aplica o toque no Item do cache na hora
 * (depois de cancelar o GET /lista em voo, que traria o valor antigo); se o servidor recusar,
 * `desfazer` tira do Item só o efeito daquele toque. No fim refaz o que deriva da Lista, salvo
 * se `refazer` disser que ainda há toque pendente.
 */
function useEscritaOtimistaDoItem<V>(opcoes: {
  /** O Item que o toque escreve. */
  alvo: (v: V) => { idLista: string; idMidia: string };
  enviar: (v: V) => Promise<unknown>;
  mostrar: (v: V, atual: ItemLista) => ItemLista;
  desfazer: (v: V, atual: ItemLista) => ItemLista;
  refazer?: () => boolean;
  chave?: readonly string[];
}) {
  const queryClient = useQueryClient();
  const invalidar = useInvalidarLista();
  const { alvo, enviar, mostrar, desfazer, refazer = () => true, chave } = opcoes;

  const trocar = (idLista: string, novo: (item: ItemLista) => ItemLista) =>
    queryClient.setQueryData<RespostaLista>(CHAVE_LISTA, (r) =>
      r && { lista: r.lista.map((item) => (item.id_lista === idLista ? novo(item) : item)) },
    );

  return useMutation({
    ...(chave ? { mutationKey: chave, scope: { id: chave.join('/') } } : {}),
    mutationFn: enviar,
    onMutate: async (v: V) => {
      await queryClient.cancelQueries({ queryKey: CHAVE_LISTA, exact: true });
      trocar(alvo(v).idLista, (atual) => mostrar(v, atual));
    },
    onError: (_e, v) => trocar(alvo(v).idLista, (atual) => desfazer(v, atual)),
    onSettled: (_r, _e, v) => (refazer() ? invalidar(alvo(v).idMidia) : undefined),
  });
}

/**
 * Troca só o Status de um Item (o menu ⋯ da Lista) com PUT /lista/<id_lista>, pelas regras
 * do editor (`mudancaDeStatus`). Aparece no cache na hora; se o servidor recusar, o Item
 * volta ao que era. A Lista refeita traz o resto (data de conclusão, Recontagem).
 */
export function useMudarStatus() {
  const api = useApi();
  return useEscritaOtimistaDoItem<{ item: ItemLista; rotulo: string }>({
    alvo: ({ item }) => ({ idLista: item.id_lista, idMidia: item.id_midia }),
    enviar: ({ item, rotulo }) =>
      exigir(
        api.PUT('/api/lista/{lista_id}', {
          params: { path: { lista_id: item.id_lista } },
          body: mudancaDeStatus(item, rotulo),
        }),
      ),
    mostrar: ({ item, rotulo }, atual) => {
      const mudanca = mudancaDeStatus(item, rotulo);
      return { ...atual, ...mudanca, status_consumo: mudanca.status_consumo as ItemLista['status_consumo'] };
    },
    desfazer: ({ item }) => item,
  });
}

const CHAVE_PROGRESSO = ['lista', 'progresso'] as const;

/** Uma sequência de toques de +1 num Item, enquanto houver toque pendente. */
type Rajada = {
  /** O Item como estava no cache antes do primeiro toque. */
  original: ItemLista;
  /** Soma dos passos que não falharam (pendentes ou confirmados): o que a tela mostra. */
  aplicado: number;
  /** Último Progresso que o servidor aceitou: base do próximo envio. */
  confirmado: number;
};

/**
 * Soma `passo` ao Progresso de um Item (o +1 do Para assistir agora) com
 * PUT /lista/<id_lista>/progresso, como o stepper do app: aparece no cache na hora, inclusive
 * a conclusão no total (`aplicarProgresso`); os toques vão um por vez, cada um sobre o último
 * valor aceito, e um toque recusado desfaz só o passo dele. Só o último a terminar refaz a Lista.
 */
export function useMudarProgresso() {
  const api = useApi();
  const queryClient = useQueryClient();
  const rajadas = useRef(new Map<string, Rajada>()).current;

  const comProgresso = (rajada: Rajada) =>
    aplicarProgresso(rajada.original, (rajada.original.progresso_atual ?? 0) + rajada.aplicado, diaIso());

  return useEscritaOtimistaDoItem<{ idLista: string; idMidia: string; passo: number }>({
    chave: CHAVE_PROGRESSO,
    alvo: (v) => v,
    enviar: async ({ idLista, passo }) => {
      const rajada = rajadas.get(idLista);
      if (!rajada) throw new Error('Item fora da Lista pessoal');
      const total = totalDoItem(rajada.original);
      const soma = rajada.confirmado + passo;
      const progresso = Math.max(0, total === null ? soma : Math.min(total, soma));
      await exigir(
        api.PUT('/api/lista/{lista_id}/progresso', {
          params: { path: { lista_id: idLista } },
          body: { progresso_atual: progresso },
        }),
      );
      rajada.confirmado = progresso;
    },
    mostrar: ({ idLista, passo }, atual) => {
      let rajada = rajadas.get(idLista);
      if (!rajada) {
        rajada = { original: atual, aplicado: 0, confirmado: atual.progresso_atual ?? 0 };
        rajadas.set(idLista, rajada);
      }
      rajada.aplicado += passo;
      return comProgresso(rajada);
    },
    desfazer: ({ idLista, passo }, atual) => {
      const rajada = rajadas.get(idLista);
      if (!rajada) return atual;
      rajada.aplicado -= passo;
      return comProgresso(rajada);
    },
    refazer: () => {
      if (queryClient.isMutating({ mutationKey: CHAVE_PROGRESSO }) !== 1) return false;
      rajadas.clear();
      return true;
    },
  });
}
