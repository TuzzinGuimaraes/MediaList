import { Tabs } from 'expo-router/js-tabs';
import { Text, type ColorValue } from 'react-native';

import { NOTIFICACOES } from '@/proto/dados';
import { cores } from '@/proto/tema';

const icone = (e: string) => ({ color }: { color: ColorValue }) => <Text style={{ fontSize: 18, color }}>{e}</Text>;

export default function TabsLayout() {
  const naoLidas = NOTIFICACOES.filter((n) => !n.lida).length;
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: cores.azul, tabBarInactiveTintColor: cores.textoSec, tabBarStyle: { backgroundColor: cores.nav, borderTopColor: cores.borda } }}>
      <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: icone('⌂') }} />
      <Tabs.Screen name="explorar" options={{ title: 'Explorar', tabBarIcon: icone('⌕') }} />
      <Tabs.Screen name="lista" options={{ title: 'Lista', tabBarIcon: icone('☰') }} />
      <Tabs.Screen name="noticias" options={{ title: 'Notícias', tabBarIcon: icone('✉'), tabBarBadge: naoLidas || undefined }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', tabBarIcon: icone('☺') }} />
    </Tabs>
  );
}
