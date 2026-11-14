import { useState } from 'react';

import { useCores } from '../tema/TemaContext';

type Consulta = { refetch: () => Promise<unknown> };

/**
 * Props do RefreshControl (puxar para atualizar) para uma ou mais consultas, na cor da marca.
 * O indicador só aparece durante o refetch pedido pelo gesto: refetches de mutação ou de
 * foco não mostram o spinner.
 */
export function useAtualizar(consulta: Consulta | Consulta[]) {
  const cores = useCores();
  const [atualizando, setAtualizando] = useState(false);
  const consultas = Array.isArray(consulta) ? consulta : [consulta];
  return {
    refreshing: atualizando,
    onRefresh: () => {
      setAtualizando(true);
      Promise.all(consultas.map((c) => c.refetch())).finally(() => setAtualizando(false));
    },
    tintColor: cores['marca-texto'],
    colors: [cores.marca],
    progressBackgroundColor: cores.superficie,
  };
}
