// Avisos de Notícias por push (spec noticias-avisos, Q129): o Expo Push Service entrega pelo FCM.
// O push remoto não existe no Expo Go (SDK 53+): lá nada aqui roda, nem o pedido de permissão.
import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { Cliente } from '../api/cliente';
import type { CorpoRegistrarToken, CorpoRemoverToken } from '../api/tipos';

/** O canal que o Backend manda no payload (`channelId: 'default'`). */
const CANAL = 'default';
/** O pedido de permissão é feito uma vez por aparelho; negado, não se pede de novo. */
const CHAVE_PEDIDO = 'medialist.avisos_pedidos';
/** O token registrado neste aparelho, para removê-lo no logout. */
const CHAVE_TOKEN = 'medialist.push_token';

export function pushDisponivel(): boolean {
  return Platform.OS !== 'web' && !isRunningInExpoGo();
}

/** Com o app aberto, o aviso aparece como banner (sem som nem badge). */
export function mostrarAvisosComAppAberto(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function permitido(): Promise<boolean> {
  const atual = await Notifications.getPermissionsAsync();
  if (atual.granted) return true;
  if (!atual.canAskAgain || (await SecureStore.getItemAsync(CHAVE_PEDIDO))) return false;
  await SecureStore.setItemAsync(CHAVE_PEDIDO, '1');
  return (await Notifications.requestPermissionsAsync()).granted;
}

/**
 * Registra (ou renova) o token do aparelho para o Usuário logado. Pede a permissão na primeira
 * vez; no Android 13+ o pedido só aparece depois de existir um canal, por isso o canal vem antes.
 * Falhar (sem rede, sem projectId) não incomoda: a próxima abertura tenta de novo.
 */
export async function registrarAparelho(cliente: Cliente): Promise<void> {
  if (!pushDisponivel()) return;
  try {
    await Notifications.setNotificationChannelAsync(CANAL, {
      name: 'Avisos',
      importance: AndroidImportance.HIGH,
    });
    if (!(await permitido())) return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const corpo: CorpoRegistrarToken = { token, plataforma: Platform.OS === 'ios' ? 'ios' : 'android' };
    await cliente.requisitar('/push/token', { metodo: 'PUT', corpo });
    await SecureStore.setItemAsync(CHAVE_TOKEN, token);
  } catch {
    // Tenta de novo na próxima abertura.
  }
}

/** No logout, antes de revogar a sessão: o aparelho deixa de receber os avisos da conta. */
export async function removerAparelho(cliente: Cliente): Promise<void> {
  const token = await SecureStore.getItemAsync(CHAVE_TOKEN);
  if (!token) return;
  const corpo: CorpoRemoverToken = { token };
  await cliente.requisitar('/push/token', { metodo: 'DELETE', corpo }).catch(() => undefined);
  await SecureStore.deleteItemAsync(CHAVE_TOKEN);
}

/** A Notícia que o aviso abre, ou null se o aviso não é de Notícia. */
export function noticiaDoAviso(resposta: Notifications.NotificationResponse | null): string | null {
  const data = resposta?.notification.request.content.data;
  if (data?.tipo !== 'noticia' || typeof data.id_noticia !== 'string' || !data.id_noticia) return null;
  return data.id_noticia;
}
