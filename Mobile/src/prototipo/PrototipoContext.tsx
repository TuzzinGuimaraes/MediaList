// PROTÓTIPO (ticket 29), descartável. Não promover para a master.
// Guarda em memória os eixos da identidade visual (paleta, tema, fonte, card, Início,
// detalhe, animação, haptics) e aplica paleta + tema + fonte em runtime: os valores
// vão como variáveis CSS (vars() do NativeWind) num View raiz, e o usePaleta() devolve
// as mesmas cores em JS (barra de abas, StatusBar, ícones).
// Um import por peso: o índice do pacote puxaria todos os pesos para o bundle.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Manrope_400Regular } from '@expo-google-fonts/manrope/400Regular';
import { Manrope_500Medium } from '@expo-google-fonts/manrope/500Medium';
import { Manrope_600SemiBold } from '@expo-google-fonts/manrope/600SemiBold';
import { Manrope_700Bold } from '@expo-google-fonts/manrope/700Bold';
import { Outfit_400Regular } from '@expo-google-fonts/outfit/400Regular';
import { Outfit_500Medium } from '@expo-google-fonts/outfit/500Medium';
import { Outfit_600SemiBold } from '@expo-google-fonts/outfit/600SemiBold';
import { Outfit_700Bold } from '@expo-google-fonts/outfit/700Bold';
import { Overpass_400Regular } from '@expo-google-fonts/overpass/400Regular';
import { Overpass_500Medium } from '@expo-google-fonts/overpass/500Medium';
import { Overpass_600SemiBold } from '@expo-google-fonts/overpass/600SemiBold';
import { Overpass_700Bold } from '@expo-google-fonts/overpass/700Bold';
import * as Haptics from 'expo-haptics';
import { useFonts } from 'expo-font';
import { vars } from 'nativewind';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useColorScheme, View } from 'react-native';

import { type ChavePaleta, type Cores, PALETAS, variaveis } from '../tema/paletas';

/** Nos testes o app abre nas variantes de controle (o layout atual) e sem a barra. */
export const EM_TESTE = process.env.NODE_ENV === 'test';

export const EIXOS = {
  paleta: {
    nome: 'paleta',
    valores: [
      { chave: 'carmesim', nome: 'Carmesim #9B1B30, fundo neutro' },
      { chave: 'bordo', nome: 'Bordô #7A1424, fundo quente' },
      { chave: 'rubi', nome: 'Rubi #B3123A, fundo frio' },
    ],
  },
  tema: {
    nome: 'tema',
    valores: [
      { chave: 'escuro', nome: 'Escuro' },
      { chave: 'claro', nome: 'Claro' },
      { chave: 'sistema', nome: 'Sistema' },
    ],
  },
  fonte: {
    nome: 'fonte',
    valores: [
      { chave: 'overpass', nome: 'Overpass (controle)' },
      { chave: 'inter', nome: 'Inter' },
      { chave: 'manrope', nome: 'Manrope' },
      { chave: 'outfit', nome: 'Outfit' },
    ],
  },
  card: {
    nome: 'card',
    valores: [
      { chave: 'a', nome: 'A · pôster limpo, título abaixo' },
      { chave: 'b', nome: 'B · pôster com info sobreposta' },
      { chave: 'c', nome: 'C · horizontal (banner)' },
    ],
  },
  inicio: {
    nome: 'inicio',
    valores: [
      { chave: 'a', nome: 'A · Netflix: destaque + carrosséis' },
      { chave: 'b', nome: 'B · destaques paginados + grade' },
      { chave: 'c', nome: 'C · atual (controle)' },
    ],
  },
  detalhe: {
    nome: 'detalhe',
    valores: [
      { chave: 'a', nome: 'A · banner + pôster sobreposto' },
      { chave: 'b', nome: 'B · pôster em tela cheia' },
      { chave: 'c', nome: 'C · atual (controle)' },
    ],
  },
  animacao: {
    nome: 'animacao',
    valores: [
      { chave: 'micro', nome: '1 · micro' },
      { chave: 'compartilhada', nome: '2 · micro + pôster compartilhado' },
    ],
  },
  haptics: {
    nome: 'haptics',
    valores: [
      { chave: 'ligado', nome: 'ligado' },
      { chave: 'desligado', nome: 'desligado' },
    ],
  },
} as const;

export type Eixo = keyof typeof EIXOS;
export type ValorDo<E extends Eixo> = (typeof EIXOS)[E]['valores'][number]['chave'];
export type Valores = { [E in Eixo]: ValorDo<E> };

const INICIAIS: Valores = EM_TESTE
  ? { paleta: 'carmesim', tema: 'escuro', fonte: 'overpass', card: 'a', inicio: 'c', detalhe: 'c', animacao: 'micro', haptics: 'desligado' }
  : { paleta: 'carmesim', tema: 'escuro', fonte: 'overpass', card: 'a', inicio: 'a', detalhe: 'a', animacao: 'compartilhada', haptics: 'ligado' };

const FAMILIAS = {
  overpass: ['Overpass_400Regular', 'Overpass_500Medium', 'Overpass_600SemiBold', 'Overpass_700Bold'],
  inter: ['Inter_400Regular', 'Inter_500Medium', 'Inter_600SemiBold', 'Inter_700Bold'],
  manrope: ['Manrope_400Regular', 'Manrope_500Medium', 'Manrope_600SemiBold', 'Manrope_700Bold'],
  outfit: ['Outfit_400Regular', 'Outfit_500Medium', 'Outfit_600SemiBold', 'Outfit_700Bold'],
} as const;

/** Famílias da fonte ativa por peso, para o que recebe fonte em JS (cabeçalho, abas). */
export type Fontes = { regular: string; medio: string; semi: string; negrito: string };

/** Cores ativas: os tokens semânticos mais os nomes antigos (copiados do web). */
export type Paleta = Cores & {
  dark: Record<'primary' | 'secondary' | 'tertiary' | 'nav' | 'border', string>;
  accent: Record<'blue' | 'blue-hover' | 'red' | 'green' | 'orange' | 'yellow', string>;
  text: Record<'primary' | 'secondary' | 'bright', string>;
};

function comLegado(c: Cores): Paleta {
  return {
    ...c,
    dark: { primary: c.fundo, secondary: c.superficie, tertiary: c['superficie-alta'], nav: c.nav, border: c.borda },
    accent: {
      blue: c['marca-texto'],
      'blue-hover': c['marca-forte'],
      red: c.erro,
      green: c['status-concluido'],
      orange: c['status-pausado'],
      yellow: c.nota,
    },
    text: { primary: c.texto, secondary: c['texto-suave'], bright: c['texto-forte'] },
  };
}

type Valor = {
  valores: Valores;
  mudar<E extends Eixo>(eixo: E, valor: ValorDo<E>): void;
  paleta: Paleta;
  escuro: boolean;
  fontes: Fontes;
};

const PADRAO_PALETA = comLegado(PALETAS.carmesim.escuro);
const PADRAO_FONTES: Fontes = { regular: FAMILIAS.overpass[0], medio: FAMILIAS.overpass[1], semi: FAMILIAS.overpass[2], negrito: FAMILIAS.overpass[3] };

const PrototipoContext = createContext<Valor>({
  valores: INICIAIS,
  mudar: () => {},
  paleta: PADRAO_PALETA,
  escuro: true,
  fontes: PADRAO_FONTES,
});

export function PrototipoProvider({ children }: { children: React.ReactNode }) {
  const [valores, setValores] = useState<Valores>(INICIAIS);
  const sistema = useColorScheme();
  const [fontesProntas, erroFontes] = useFonts({
    Overpass_400Regular,
    Overpass_500Medium,
    Overpass_600SemiBold,
    Overpass_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
  });

  const mudar = useCallback(<E extends Eixo>(eixo: E, valor: ValorDo<E>) => {
    setValores((v) => ({ ...v, [eixo]: valor }));
  }, []);

  const escuro = valores.tema === 'sistema' ? sistema !== 'light' : valores.tema === 'escuro';
  const cores = PALETAS[valores.paleta as ChavePaleta][escuro ? 'escuro' : 'claro'];
  const familias = FAMILIAS[valores.fonte];

  const valor = useMemo<Valor>(
    () => ({
      valores,
      mudar,
      paleta: comLegado(cores),
      escuro,
      fontes: { regular: familias[0], medio: familias[1], semi: familias[2], negrito: familias[3] },
    }),
    [valores, mudar, cores, escuro, familias],
  );

  const estilo = useMemo(
    () =>
      vars({
        ...variaveis(cores),
        '--fonte-400': familias[0],
        '--fonte-500': familias[1],
        '--fonte-600': familias[2],
        '--fonte-700': familias[3],
      }),
    [cores, familias],
  );

  // Sem as fontes, o texto sairia na fonte do sistema e trocaria ao carregar.
  if (!fontesProntas && !erroFontes && !EM_TESTE) return null;

  return (
    <PrototipoContext.Provider value={valor}>
      <View style={[{ flex: 1, backgroundColor: cores.fundo }, estilo]}>{children}</View>
    </PrototipoContext.Provider>
  );
}

export function usePrototipo() {
  return useContext(PrototipoContext);
}

export function useEixo<E extends Eixo>(eixo: E): ValorDo<E> {
  return useContext(PrototipoContext).valores[eixo];
}

export function usePaleta(): Paleta {
  return useContext(PrototipoContext).paleta;
}

export function useFontes(): Fontes {
  return useContext(PrototipoContext).fontes;
}

/** Vibração leve nas confirmações (salvar Item, stepper), se o eixo haptics estiver ligado. */
export function useVibrar() {
  const ligado = useEixo('haptics') === 'ligado';
  return useCallback(
    (tipo: 'toque' | 'sucesso' = 'toque') => {
      if (!ligado) return;
      if (tipo === 'sucesso') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    },
    [ligado],
  );
}
