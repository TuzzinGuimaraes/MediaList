import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSessao } from '../auth/SessaoContext';
import type { NomePlataforma } from '@dominio/integracoes';
import type {
  Integracao,
  PaginaMidias,
  PreviaImportacao,
  RespostaIntegracoes,
  ResultadoImportacao,
  ResultadoSincronizacao,
  TipoMidia,
  VinculoCriado,
} from './tipos';

// Integrações no Perfil (ADR 0015), as mesmas rotas do web, sem o XML do MAL.

const CHAVE = ['integracoes'] as const;

/**
 * O que uma importação ou sincronização muda: a própria Integração (última sincronização), a
 * Lista (e o fio/selos dos cards), as estatísticas do Perfil e os contadores das Mídias.
 */
function invalidarDepoisDeImportar(queryClient: QueryClient) {
  return Promise.all(
    [CHAVE, ['lista'], ['usuario', 'estatisticas'], ['midias']].map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  );
}

const caminho = (plataforma: NomePlataforma) => `/integracoes/${encodeURIComponent(plataforma)}`;

/** Uma linha por plataforma que a API registra (GET /integracoes). */
export function useIntegracoes() {
  const { cliente } = useSessao();
  return useQuery({
    queryKey: CHAVE,
    queryFn: () => cliente.requisitar<RespostaIntegracoes>('/integracoes'),
    select: (r) => r.integracoes,
  });
}

/** Conecta a conta pública (PUT /integracoes/<plataforma>); a API valida se o perfil é público. */
export function useConectar(plataforma: NomePlataforma) {
  const { cliente } = useSessao();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (identificador: string) =>
      cliente.requisitar<Integracao>(caminho(plataforma), { metodo: 'PUT', corpo: { identificador } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHAVE }),
  });
}

export function useDesconectar(plataforma: NomePlataforma) {
  const { cliente } = useSessao();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => cliente.requisitar(caminho(plataforma), { metodo: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CHAVE }),
  });
}

/** A prévia não grava nada; vale 1 h. */
export function useGerarPrevia(plataforma: NomePlataforma) {
  const { cliente } = useSessao();
  return useMutation({
    mutationFn: () => cliente.requisitar<PreviaImportacao>(`${caminho(plataforma)}/previa`, { metodo: 'POST' }),
  });
}

export function useConfirmarPrevia() {
  const { cliente } = useSessao();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (idPrevia: string) =>
      cliente.requisitar<ResultadoImportacao>(`/integracoes/previas/${encodeURIComponent(idPrevia)}/confirmar`, {
        metodo: 'POST',
      }),
    onSuccess: () => invalidarDepoisDeImportar(queryClient),
  });
}

/** "Sincronizar agora" da Steam: grava direto, sem prévia; o que não coube fica pendente. */
export function useSincronizarSteam() {
  const { cliente } = useSessao();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => cliente.requisitar<ResultadoSincronizacao>('/integracoes/steam/sincronizar', { metodo: 'POST' }),
    onSuccess: () => invalidarDepoisDeImportar(queryClient),
  });
}

/** Quantas Mídias a busca do Vincular mostra. */
const POR_PAGINA_VINCULAR = 10;

/** A busca do Catálogo do Vincular (GET /midias, a do Explorar), só no Tipo do item; vazia não busca. */
export function useBuscaDoVincular(tipo: TipoMidia, busca: string) {
  const { cliente } = useSessao();
  return useQuery({
    queryKey: ['midias', 'vincular', tipo, busca],
    queryFn: () => {
      const params = new URLSearchParams({ tipo, busca, por_pagina: String(POR_PAGINA_VINCULAR) });
      return cliente.requisitar<PaginaMidias>(`/midias?${params}`);
    },
    enabled: busca.length > 0,
    select: (r) => r.itens,
  });
}

/** Vincula um Não encontrado a uma Mídia (vale para todos) e o Item já entra na Lista. */
export function useVincular(plataforma: NomePlataforma) {
  const { cliente } = useSessao();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ origem_id, id_midia }: { origem_id: string; id_midia: string }) =>
      cliente.requisitar<VinculoCriado>('/integracoes/vinculos', {
        metodo: 'POST',
        corpo: { plataforma, origem_id, id_midia },
      }),
    // Sem esperar: a lista nova dos Não encontrados já vem sem o item e desmonta quem vinculou,
    // e o `onSuccess` do `mutate` (fechar, vibrar) tem de rodar antes.
    onSuccess: () => void invalidarDepoisDeImportar(queryClient),
  });
}
