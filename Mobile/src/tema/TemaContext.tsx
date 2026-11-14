// Um import por peso: o índice do pacote puxaria todos os pesos para o bundle.
import { Outfit_400Regular } from '@expo-google-fonts/outfit/400Regular';
import { Outfit_600SemiBold } from '@expo-google-fonts/outfit/600SemiBold';
import { Outfit_700Bold } from '@expo-google-fonts/outfit/700Bold';
import { useFonts } from 'expo-font';
import * as SecureStore from 'expo-secure-store';
import { vars } from 'nativewind';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme, View } from 'react-native';

import { CORES, type Cores, variaveis } from './cores';
import { PREFERENCIA_PADRAO, type PreferenciaTema, resolverTema, type Tema } from './tema';

const CHAVE = 'medialist.tema';
const PREFERENCIAS: readonly PreferenciaTema[] = ['sistema', 'escuro', 'claro'];

type ValorTema = {
  preferencia: PreferenciaTema;
  escolher(preferencia: PreferenciaTema): void;
  /** Tema aplicado (Sistema já resolvido). */
  tema: Tema;
  /** Cores do tema aplicado, para o que recebe cor em JS (ícones, barra de abas, StatusBar). */
  cores: Cores;
};

const TemaContext = createContext<ValorTema>({
  preferencia: PREFERENCIA_PADRAO,
  escolher: () => {},
  tema: 'escuro',
  cores: CORES.escuro,
});

/**
 * Aplica o tema (variáveis CSS num View raiz, lidas pelas classes do NativeWind) e carrega
 * a fonte. Até a preferência guardada e a fonte chegarem, nada renderiza: a splash continua
 * na tela e o texto não troca de fonte nem de cor ao carregar.
 */
export function TemaProvider({ children }: { children: React.ReactNode }) {
  const esquema = useColorScheme();
  const [preferencia, setPreferencia] = useState<PreferenciaTema | null>(null);
  const [fontesProntas, erroFontes] = useFonts({ Outfit_400Regular, Outfit_600SemiBold, Outfit_700Bold });

  useEffect(() => {
    let vivo = true;
    SecureStore.getItemAsync(CHAVE)
      .catch(() => null)
      .then((guardada) => {
        if (!vivo) return;
        const valida = PREFERENCIAS.find((p) => p === guardada);
        setPreferencia(valida ?? PREFERENCIA_PADRAO);
      });
    return () => {
      vivo = false;
    };
  }, []);

  const escolher = useCallback((nova: PreferenciaTema) => {
    setPreferencia(nova);
    SecureStore.setItemAsync(CHAVE, nova).catch(() => {});
  }, []);

  const atual = preferencia ?? PREFERENCIA_PADRAO;
  const tema = resolverTema(atual, esquema);
  const valor = useMemo(() => ({ preferencia: atual, escolher, tema, cores: CORES[tema] }), [atual, escolher, tema]);
  const estilo = useMemo(() => vars(variaveis(tema)), [tema]);

  // Sem a fonte (erro de carregamento), o app segue na fonte do sistema.
  if (preferencia === null || (!fontesProntas && !erroFontes)) return null;

  return (
    <TemaContext.Provider value={valor}>
      <View style={[{ flex: 1, backgroundColor: valor.cores.fundo }, estilo]}>{children}</View>
    </TemaContext.Provider>
  );
}

export function useTema(): ValorTema {
  return useContext(TemaContext);
}

export function useCores(): Cores {
  return useContext(TemaContext).cores;
}
