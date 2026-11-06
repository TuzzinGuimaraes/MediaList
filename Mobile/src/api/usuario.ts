import { useQuery } from '@tanstack/react-query';

import { useSessao } from '../auth/SessaoContext';
import type { RespostaMe, RespostaPermissoes } from './tipos';

export function useUsuarioAtual() {
  const { cliente } = useSessao();
  return useQuery({
    queryKey: ['usuario', 'me'],
    queryFn: () => cliente.requisitar<RespostaMe>('/auth/me'),
    select: (r) => r.usuario,
  });
}

export function usePermissoes() {
  const { cliente } = useSessao();
  return useQuery({
    queryKey: ['usuario', 'permissoes'],
    queryFn: () => cliente.requisitar<RespostaPermissoes>('/usuario/permissoes'),
    select: (r) => r.permissoes,
  });
}
