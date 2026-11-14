import '../global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';

import { criarQueryClient, ligarFocoAoAppState } from '@/api/consulta';
import { SessaoProvider } from '@/auth/SessaoContext';
import { RecorteProvider } from '@/recorte/RecorteContext';
import { useReduzirMovimento } from '@/tema/movimento';
import { TemaProvider, useTema } from '@/tema/TemaContext';

export default function RootLayout() {
  const [queryClient] = useState(criarQueryClient);
  useEffect(ligarFocoAoAppState, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TemaProvider>
        <Navegacao />
      </TemaProvider>
    </QueryClientProvider>
  );
}

/** Tema da navegação e StatusBar seguem o tema aplicado. */
function Navegacao() {
  const { tema, cores } = useTema();
  const reduzir = useReduzirMovimento();
  const escuro = tema === 'escuro';
  const temaNavegacao = useMemo(() => {
    const base = escuro ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: cores['marca-texto'],
        background: cores.fundo,
        card: cores.nav,
        text: cores['texto-forte'],
        border: cores.borda,
      },
    };
  }, [escuro, cores]);

  return (
    <ThemeProvider value={temaNavegacao}>
      <SessaoProvider>
        <RecorteProvider>
          <StatusBar style={escuro ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: cores.fundo },
              // Animação micro: as telas entram com um fade curto.
              animation: reduzir ? 'none' : 'fade',
              animationDuration: 280,
            }}
          />
        </RecorteProvider>
      </SessaoProvider>
    </ThemeProvider>
  );
}
