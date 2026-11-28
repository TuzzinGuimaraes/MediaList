// Os destaques do Perfil (GET /usuario/conquistas/destaques), sob a chave que a escrita do Detalhe invalida.
import { useQuery } from '@tanstack/react-query';

import { chaves } from '../api/chaves';
import { exigir } from '../api/cliente';
import { useApi } from '../sessao/SessaoContext';

export function useDestaques() {
  const api = useApi();
  return useQuery({
    queryKey: chaves.conquistas.destaques,
    queryFn: () => exigir(api.GET('/api/usuario/conquistas/destaques')),
  });
}
