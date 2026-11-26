// As rotas de detalhe que o app abre de mais de um lugar (Notificações, push).
import type { Href } from 'expo-router';

export function rotaDaMidia(id: string): Href {
  return { pathname: '/midia/[id]', params: { id } };
}

export function rotaDaNoticia(id: string): Href {
  return { pathname: '/noticia/[id]', params: { id } };
}
