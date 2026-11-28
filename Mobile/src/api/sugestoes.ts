import { useQuery } from '@tanstack/react-query';

import { useSessao } from '../auth/SessaoContext';
import type { TipoMidia } from '@dominio/estadoConsumo';
import { CHAVE_SUGESTOES, faixaDasSugestoes, pedidoDasSugestoes } from '@dominio/sugestoes';
import type { RespostaSugestoes } from './tipos';

/** Prefixo das Sugestões no cache (`@dominio/sugestoes`): toda escrita da Lista as refaz (lista.ts). */
export { CHAVE_SUGESTOES };

/**
 * Sugestões para você: uma requisição para os Tipos da tela, só com sessão. O pedido e o que a
 * faixa mostra são de `@dominio/sugestoes`; no Recorte de jogos, não pede e a faixa some.
 */
export function useSugestoes(tipos: readonly TipoMidia[]) {
  const { cliente, sessao } = useSessao();
  const { ativa, chave, consulta } = pedidoDasSugestoes(tipos, sessao.estado === 'autenticada');
  const caminho = consulta.tipo ? `/sugestoes?tipo=${consulta.tipo}` : '/sugestoes';
  const resultado = useQuery({
    enabled: ativa,
    queryKey: chave,
    queryFn: () => cliente.requisitar<RespostaSugestoes>(caminho),
    select: (r) => r.sugestoes,
  });
  return { ...faixaDasSugestoes(ativa, resultado), refetch: resultado.refetch };
}
