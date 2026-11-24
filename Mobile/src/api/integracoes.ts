import { type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSessao } from '../auth/SessaoContext';
import type { NomePlataforma } from '@dominio/integracoes';
import type {
  Integracao,
  PreviaImportacao,
  RespostaIntegracoes,
  ResultadoImportacao,
  ResultadoSincronizacao,
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
