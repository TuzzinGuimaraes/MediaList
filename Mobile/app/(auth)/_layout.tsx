import { Redirect, Stack } from 'expo-router';

import { useSessao } from '@/auth/SessaoContext';
import { Carregando } from '@/components/EstadoTela';

export default function AuthLayout() {
  const { sessao } = useSessao();
  if (sessao.estado === 'carregando') return <Carregando />;
  if (sessao.estado === 'autenticada') return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
