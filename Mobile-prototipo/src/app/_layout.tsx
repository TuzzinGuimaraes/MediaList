// PROTÓTIPO descartável do MediaList Mobile (ticket 01). Ver README.md.
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { EditorSheet } from '@/proto/editor';
import { ProtoProvider } from '@/proto/estado';
import { cores } from '@/proto/tema';

const tema = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: cores.fundo, card: cores.nav, border: cores.borda, primary: cores.azul, text: cores.textoForte },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={tema}>
      <ProtoProvider>
        <StatusBar style="light" />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="midia/[id]" options={{ title: 'Mídia', headerBackTitle: 'Voltar' }} />
          <Stack.Screen name="editor/[id]" options={{ title: 'Editar Item', presentation: 'fullScreenModal' }} />
        </Stack>
        <EditorSheet />
      </ProtoProvider>
    </ThemeProvider>
  );
}
