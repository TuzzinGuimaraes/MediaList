import '../global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { criarQueryClient, ligarFocoAoAppState } from '@/api/consulta';
import { SessaoProvider } from '@/auth/SessaoContext';
import { RecorteProvider } from '@/recorte/RecorteContext';
import paleta from '@/tema/paleta';

const tema = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: paleta.accent.blue,
    background: paleta.dark.primary,
    card: paleta.dark.nav,
    text: paleta.text.bright,
    border: paleta.dark.border,
  },
};

export default function RootLayout() {
  const [queryClient] = useState(criarQueryClient);
  useEffect(ligarFocoAoAppState, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={tema}>
        <SessaoProvider>
          <RecorteProvider>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false }} />
          </RecorteProvider>
        </SessaoProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
