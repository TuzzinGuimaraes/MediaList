import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSessao } from '../auth/SessaoContext';
import { aplicarProgresso, type DadosItem } from '../dominio/itemLista';
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
 * Refaz tudo o que deriva da Lista: ['lista'] cobre também ['lista','estatisticas'];
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

/**
 * − / + do stepper: aplica no cache na hora (inclusive a conclusão no total) e
 * desfaz se o servidor recusar. Com toques seguidos, só o último a terminar refaz a Lista.
 */
export function useMudarProgresso() {
  const { cliente } = useSessao();
  const queryClient = useQueryClient();
  const invalidar = useInvalidarLista();
  return useMutation({
    mutationKey: CHAVE_PROGRESSO,
    mutationFn: ({ idLista, progresso }: { idLista: string; idMidia: string; progresso: number }) =>
      cliente.requisitar(`/lista/${encodeURIComponent(idLista)}/progresso`, {
        metodo: 'PUT',
        corpo: { progresso_atual: progresso },
      }),
    onMutate: async ({ idLista, progresso }) => {
      await queryClient.cancelQueries({ queryKey: CHAVE, exact: true });
      const anterior = queryClient.getQueryData<RespostaLista>(CHAVE);
      queryClient.setQueryData<RespostaLista>(CHAVE, (r) =>
        r && {
          lista: r.lista.map((item) =>
            item.id_lista === idLista
              ? { ...item, ...aplicarProgresso({ ...item, data_conclusao: item.data_conclusao ?? null }, progresso, hoje()) }
              : item,
          ),
        },
      );
      return { anterior };
    },
    onError: (_e, _v, contexto) => {
      if (contexto?.anterior) queryClient.setQueryData(CHAVE, contexto.anterior);
    },
    onSettled: (_r, _e, { idMidia }) => {
      if (queryClient.isMutating({ mutationKey: CHAVE_PROGRESSO }) === 1) return invalidar(idMidia);
    },
  });
}
