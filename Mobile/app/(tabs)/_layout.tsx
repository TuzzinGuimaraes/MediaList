import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

import { useNaoLidas } from '@/api/noticias';
import { useSessao } from '@/auth/SessaoContext';
import { Carregando } from '@/components/EstadoTela';
import { SeletorRecorte } from '@/components/SeletorRecorte';
import { useFontes, usePaleta } from '@/prototipo/PrototipoContext';
import { useAnimar } from '@/prototipo/PrototipoMovimento';
import tipografia from '@/tema/tipografia';

type Icone = ComponentProps<typeof Ionicons>['name'];

/** `recorte`: a aba mostra a pílula do Recorte de catálogo no cabeçalho. */
const abas: { nome: string; titulo: string; icone: Icone; recorte?: boolean }[] = [
  { nome: 'index', titulo: 'Início', icone: 'home-outline', recorte: true },
  { nome: 'explorar', titulo: 'Explorar', icone: 'search-outline', recorte: true },
  { nome: 'lista', titulo: 'Lista', icone: 'list-outline', recorte: true },
  { nome: 'noticias', titulo: 'Notícias', icone: 'newspaper-outline' },
  { nome: 'perfil', titulo: 'Perfil', icone: 'person-outline' },
];

export default function AbasLayout() {
  const { sessao } = useSessao();
  const naoLidas = useNaoLidas();
  const paleta = usePaleta();
  const fontes = useFontes();
  const animar = useAnimar();
  if (sessao.estado === 'carregando') return <Carregando />;
  // Sem sessão (nunca entrou, saiu, ou o refresh falhou): volta ao login.
  if (sessao.estado === 'anonima') return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: paleta.dark.nav },
        headerTintColor: paleta.text.bright,
        headerTitleAlign: 'left',
        headerTitleStyle: { fontFamily: fontes.negrito, fontSize: tipografia['titulo-secao'].tamanho },
        headerShadowVisible: false,
        // PROTÓTIPO (ticket 29): troca de aba com fade curto.
        animation: animar ? 'fade' : 'none',
        tabBarLabelStyle: { fontSize: tipografia.legenda.tamanho, fontFamily: fontes.semi },
        tabBarStyle: { backgroundColor: paleta.dark.nav, borderTopColor: paleta.dark.border },
        tabBarActiveTintColor: paleta['marca-texto'],
        tabBarBadgeStyle: { backgroundColor: paleta.marca, color: paleta['sobre-marca'] },
        tabBarInactiveTintColor: paleta.text.secondary,
      }}
    >
      {abas.map((aba) => (
        <Tabs.Screen
          key={aba.nome}
          name={aba.nome}
          options={{
            title: aba.titulo,
            headerRight: aba.recorte ? () => <SeletorRecorte /> : undefined,
            tabBarBadge: aba.nome === 'noticias' && naoLidas > 0 ? naoLidas : undefined,
            tabBarIcon: ({ color, size }) => <Ionicons name={aba.icone} color={color as string} size={size} />,
          }}
        />
      ))}
    </Tabs>
  );
}
