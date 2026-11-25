// Consultas e escritas da Lista pessoal. As rotas de escrita (Backend/routes/lista.py) só
// respondem `{mensagem}` (e `id_lista` no POST): o Item gravado, inclusive a promoção a
// Concluído, vem do GET /lista refeito.
//
// Cache: chaves.lista.toda (['lista']) guarda o RespostaLista inteiro (GET /api/lista); o
// Início, o detalhe e o Perfil leem a mesma chave (`useLista`, `useItemDaMidia`).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { type DadosItem, mudancaDeStatus } from '@dominio/itemLista';

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
