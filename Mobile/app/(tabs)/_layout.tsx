import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';
import type { ComponentProps } from 'react';

import { useNaoLidas } from '@/api/noticias';
import { useSessao } from '@/auth/SessaoContext';
import { Carregando } from '@/components/EstadoTela';
import { Monograma } from '@/components/Monograma';
import { SeletorRecorte } from '@/components/SeletorRecorte';
import { FONTES } from '@/tema/cores';
import { useReduzirMovimento } from '@/tema/movimento';
import { useCores } from '@/tema/TemaContext';
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
  const cores = useCores();
  const reduzir = useReduzirMovimento();
  if (sessao.estado === 'carregando') return <Carregando />;
  // Sem sessão (nunca entrou, saiu, ou o refresh falhou): volta ao login.
  if (sessao.estado === 'anonima') return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: cores.nav },
        headerTintColor: cores['texto-forte'],
        headerTitleAlign: 'left',
        headerTitleStyle: { fontFamily: FONTES.negrito, fontSize: tipografia['titulo-secao'].tamanho },
        headerShadowVisible: false,
        animation: reduzir ? 'none' : 'fade',
        tabBarLabelStyle: { fontFamily: FONTES.semi, fontSize: tipografia.legenda.tamanho },
        tabBarStyle: { backgroundColor: cores.nav, borderTopColor: cores.borda },
        tabBarActiveTintColor: cores['marca-texto'],
        tabBarInactiveTintColor: cores['texto-suave'],
        tabBarBadgeStyle: { backgroundColor: cores.marca, color: cores['sobre-marca'] },
      }}
    >
      {abas.map((aba) => (
        <Tabs.Screen
          key={aba.nome}
          name={aba.nome}
          options={{
            title: aba.titulo,
            // No Início, o monograma "M" no lugar do título de texto.
            headerTitle: aba.nome === 'index' ? () => <Monograma tamanho={30} /> : undefined,
            headerRight: aba.recorte ? () => <SeletorRecorte /> : undefined,
            tabBarBadge: aba.nome === 'noticias' && naoLidas > 0 ? naoLidas : undefined,
            tabBarIcon: ({ color, size }) => <Ionicons name={aba.icone} color={color as string} size={size} />,
          }}
        />
      ))}
    </Tabs>
  );
}
