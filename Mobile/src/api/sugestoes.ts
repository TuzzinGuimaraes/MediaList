import { useQuery } from '@tanstack/react-query';

import { useSessao } from '../auth/SessaoContext';
import type { TipoMidia } from '@dominio/estadoConsumo';
import { consultaDasSugestoes } from '@dominio/sugestoes';
import type { RespostaSugestoes, Sugestao } from './tipos';

/**
 * Prefixo das Sugestões (GET /sugestoes): toda escrita da Lista as refaz (lista.ts). Fica sob
 * ['midias'], como tudo que mostra a Nota média, para uma Avaliação gravada alcançá-las.
 */
export const CHAVE_SUGESTOES = ['midias', 'sugestoes'] as const;

/**
 * Sugestões para você: uma requisição para os Tipos da tela, só com sessão. Sem anime nem mangá
 * (o Recorte de jogos), não pede: a lista fica vazia e a faixa some. Com erro, a faixa só some.
 */
export function useSugestoes(tipos: readonly TipoMidia[]) {
  const { cliente, sessao } = useSessao();
  const consulta = consultaDasSugestoes(tipos);
  const ativa = consulta !== null && sessao.estado === 'autenticada';
  const caminho = consulta?.tipo ? `/sugestoes?tipo=${consulta.tipo}` : '/sugestoes';
  const resultado = useQuery({
    enabled: ativa,
    queryKey: [...CHAVE_SUGESTOES, consulta?.tipo ?? null],
    queryFn: () => cliente.requisitar<RespostaSugestoes>(caminho),
    select: (r) => r.sugestoes,
  });
  // Desligada, a consulta fica "pending" para sempre: aqui ela conta como pronta e vazia.
  const sugestoes: Sugestao[] | undefined = ativa ? (resultado.data ?? (resultado.isError ? [] : undefined)) : [];
  return { sugestoes, pendente: ativa && resultado.isPending, refetch: resultado.refetch };
}
