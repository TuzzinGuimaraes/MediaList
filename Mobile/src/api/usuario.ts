import { useQuery } from '@tanstack/react-query';

import { useSessao } from '../auth/SessaoContext';
import type { RespostaMe, RespostaPermissoes } from './tipos';

export function useUsuarioAtual() {
  const { cliente, trocaObrigatoria } = useSessao();
  return useQuery({
    queryKey: ['usuario', 'me'],
    queryFn: async () => {
      const me = await cliente.requisitar<RespostaMe>('/auth/me');
      // O /auth/me responde mesmo com a Senha temporária pendente: a flag leva à tela de troca.
      if (me.deve_trocar_senha) trocaObrigatoria();
      return me;
    },
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
