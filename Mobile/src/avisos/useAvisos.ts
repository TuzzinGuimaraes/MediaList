import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import { useSessao } from '../auth/SessaoContext';
import { mostrarAvisosComAppAberto, noticiaDoAviso, pushDisponivel, registrarAparelho } from './push';

/**
 * Com a sessão autenticada (depois do login ou ao abrir o app já logado): pede a permissão na
 * primeira vez e registra ou renova o token; se o sistema trocar o token, registra o novo.
 */
export function useRegistroDoAparelho(): void {
  const { sessao, cliente } = useSessao();
  const idUsuario = sessao.estado === 'autenticada' ? sessao.usuario.id : null;

  useEffect(() => {
    if (!idUsuario || !pushDisponivel()) return;
    void registrarAparelho(cliente);
    const assinatura = Notifications.addPushTokenListener(() => void registrarAparelho(cliente));
    return () => assinatura.remove();
  }, [idUsuario, cliente]);
}

/**
 * Tocar no aviso abre a Notícia: com o app aberto ou em segundo plano pelo ouvinte; com o app
 * fechado pela última resposta, lida ao montar. A tela da Notícia cuida da sessão.
 */
export function useToqueNoAviso(): void {
  useEffect(() => {
    if (!pushDisponivel()) return;
    mostrarAvisosComAppAberto();

    const abrir = (resposta: Notifications.NotificationResponse | null) => {
      const id = noticiaDoAviso(resposta);
      if (!id) return;
      router.push({ pathname: '/noticia/[id]', params: { id } });
      Notifications.clearLastNotificationResponse();
    };

    abrir(Notifications.getLastNotificationResponse());
    const assinatura = Notifications.addNotificationResponseReceivedListener(abrir);
    return () => assinatura.remove();
  }, []);
}
