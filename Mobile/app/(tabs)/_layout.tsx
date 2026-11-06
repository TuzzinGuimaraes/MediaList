import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

import { useNaoLidas } from '@/api/noticias';
import { useSessao } from '@/auth/SessaoContext';
import { Carregando } from '@/components/EstadoTela';
import paleta from '@/tema/paleta';

type Icone = ComponentProps<typeof Ionicons>['name'];

const abas: { nome: string; titulo: string; icone: Icone }[] = [
  { nome: 'index', titulo: 'Início', icone: 'home-outline' },
  { nome: 'explorar', titulo: 'Explorar', icone: 'search-outline' },
  { nome: 'lista', titulo: 'Lista', icone: 'list-outline' },
  { nome: 'noticias', titulo: 'Notícias', icone: 'newspaper-outline' },
  { nome: 'perfil', titulo: 'Perfil', icone: 'person-outline' },
];

export default function AbasLayout() {
  const { sessao } = useSessao();
  const naoLidas = useNaoLidas();
  if (sessao.estado === 'carregando') return <Carregando />;
  // Sem sessão (nunca entrou, saiu, ou o refresh falhou): volta ao login.
  if (sessao.estado === 'anonima') return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: paleta.dark.nav },
        headerTintColor: paleta.text.bright,
        tabBarStyle: { backgroundColor: paleta.dark.nav, borderTopColor: paleta.dark.border },
        tabBarActiveTintColor: paleta.accent.blue,
        tabBarInactiveTintColor: paleta.text.secondary,
      }}
    >
      {abas.map((aba) => (
        <Tabs.Screen
          key={aba.nome}
          name={aba.nome}
          options={{
            title: aba.titulo,
            tabBarBadge: aba.nome === 'noticias' && naoLidas > 0 ? naoLidas : undefined,
            tabBarIcon: ({ color, size }) => <Ionicons name={aba.icone} color={color as string} size={size} />,
          }}
        />
      ))}
    </Tabs>
  );
}
