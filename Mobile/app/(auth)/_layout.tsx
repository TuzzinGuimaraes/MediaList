import { Redirect, Stack } from 'expo-router';

import { useSessao } from '@/auth/SessaoContext';
import { Carregando } from '@/components/EstadoTela';

export default function AuthLayout() {
  const { sessao } = useSessao();
  if (sessao.estado === 'carregando') return <Carregando />;
  if (sessao.estado === 'autenticada') return <Redirect href="/" />;
  if (sessao.estado === 'troca_de_senha') return <Redirect href="/definir-senha" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
