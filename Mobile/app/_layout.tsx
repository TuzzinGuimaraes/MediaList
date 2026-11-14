import '../global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';

import { criarQueryClient, ligarFocoAoAppState } from '@/api/consulta';
import { SessaoProvider } from '@/auth/SessaoContext';
import { PrototipoBarra } from '@/prototipo/PrototipoBarra';
import { PrototipoProvider, usePrototipo } from '@/prototipo/PrototipoContext';
import { useAnimar } from '@/prototipo/PrototipoMovimento';
import { RecorteProvider } from '@/recorte/RecorteContext';

export default function RootLayout() {
  const [queryClient] = useState(criarQueryClient);
  useEffect(ligarFocoAoAppState, []);

  return (
    <QueryClientProvider client={queryClient}>
      <PrototipoProvider>
        <Interior />
      </PrototipoProvider>
    </QueryClientProvider>
  );
}

/** PROTÓTIPO (ticket 29): tema de navegação e StatusBar seguem o eixo `tema`. */
function Interior() {
  const { paleta, escuro } = usePrototipo();
  const animar = useAnimar();
  const tema = useMemo(() => {
    const base = escuro ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: paleta['marca-texto'],
        background: paleta.fundo,
        card: paleta.nav,
        text: paleta['texto-forte'],
        border: paleta.borda,
      },
    };
  }, [paleta, escuro]);

  return (
    <ThemeProvider value={tema}>
      <SessaoProvider>
        <RecorteProvider>
          <StatusBar style={escuro ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: paleta.fundo },
              // Animação micro (2ª rodada): as telas entram com fade curto.
              animation: animar ? 'fade' : 'none',
              animationDuration: 280,
            }}
          />
          <PrototipoBarra />
        </RecorteProvider>
      </SessaoProvider>
    </ThemeProvider>
  );
}
