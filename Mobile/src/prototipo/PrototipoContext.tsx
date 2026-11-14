// PROTÓTIPO (ticket 29), descartável. Não promover para a master.
// 2ª rodada: paleta (Carmesim no escuro, Rubi no claro), fonte (Outfit), animação (micro)
// e haptics (leve ao salvar/remover Item) ficaram fixos. Sobram em memória os eixos
// tema, card e assinatura. As cores vão como variáveis CSS (vars() do NativeWind) num
// View raiz, e o usePaleta() devolve as mesmas cores em JS (barra de abas, StatusBar, ícones).
// Um import por peso: o índice do pacote puxaria todos os pesos para o bundle.
import { Outfit_400Regular } from '@expo-google-fonts/outfit/400Regular';
import { Outfit_500Medium } from '@expo-google-fonts/outfit/500Medium';
import { Outfit_600SemiBold } from '@expo-google-fonts/outfit/600SemiBold';
import { Outfit_700Bold } from '@expo-google-fonts/outfit/700Bold';
import * as Haptics from 'expo-haptics';
import { useFonts } from 'expo-font';
import { vars } from 'nativewind';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useColorScheme, View } from 'react-native';

import { type Cores, TEMAS, variaveis } from '../tema/paletas';

/** Nos testes a barra não aparece e nada busca o AniList. */
export const EM_TESTE = process.env.NODE_ENV === 'test';

export const EIXOS = {
  tema: {
    nome: 'tema',
    valores: [
      { chave: 'escuro', nome: 'Escuro (Carmesim)' },
      { chave: 'claro', nome: 'Claro (Rubi)' },
      { chave: 'sistema', nome: 'Sistema' },
    ],
  },
  card: {
    nome: 'card',
    valores: [
      { chave: 'contexto', nome: 'Por contexto: C no Continuar/destaques, A no resto' },
      { chave: 'compacto', nome: 'C compacto (~70% da tela) em todos' },
      { chave: 'c', nome: 'C em todos (controle)' },
    ],
  },
  assinatura: {
    nome: 'assinatura',
    valores: [
      { chave: 'nenhuma', nome: 'Nenhuma' },
      { chave: 'ambiente', nome: 'Cor ambiente' },
      { chave: 'fio', nome: 'Fio de progresso' },
      { chave: 'diagonal', nome: 'Corte diagonal' },
      { chave: 'todas', nome: 'Todas' },
    ],
  },
  // 3ª rodada (ticket 34): Lista e Explorar.
  'lista-status': {
    nome: 'lista-status',
    valores: [
      { chave: 'pilula', nome: 'Pílula com menu' },
      { chave: 'secoes', nome: 'Seções recolhíveis' },
      { chave: 'paginas', nome: 'Páginas deslizáveis' },
    ],
  },
  'lista-tipo': {
    nome: 'lista-tipo',
    valores: [
      { chave: 'misturado', nome: 'Misturado (controle)' },
      { chave: 'subsecoes', nome: 'Subseções por Tipo' },
      { chave: 'carrosseis', nome: 'Carrosséis por Tipo (card C)' },
    ],
  },
  explorar: {
    nome: 'explorar',
    valores: [
      { chave: 'esconde', nome: 'Esconde ao rolar' },
      { chave: 'compacto', nome: 'Compacto, filtros num sheet' },
      { chave: 'ambos', nome: 'Compacto + esconde' },
    ],
  },
} as const;

export type Eixo = keyof typeof EIXOS;
export type ValorDo<E extends Eixo> = (typeof EIXOS)[E]['valores'][number]['chave'];
export type Valores = { [E in Eixo]: ValorDo<E> };

// Nos testes a Lista e o Explorar abrem nas variantes de controle (pílula, misturado, esconde),
// as mais próximas das asserções antigas.
const INICIAIS: Valores = EM_TESTE
  ? { tema: 'escuro', card: 'contexto', assinatura: 'fio', 'lista-status': 'pilula', 'lista-tipo': 'misturado', explorar: 'esconde' }
  : { tema: 'escuro', card: 'contexto', assinatura: 'fio', 'lista-status': 'secoes', 'lista-tipo': 'subsecoes', explorar: 'ambos' };

const OUTFIT = ['Outfit_400Regular', 'Outfit_500Medium', 'Outfit_600SemiBold', 'Outfit_700Bold'] as const;

/** Famílias da Outfit por peso, para o que recebe fonte em JS (cabeçalho, abas). */
export type Fontes = { regular: string; medio: string; semi: string; negrito: string };
const FONTES: Fontes = { regular: OUTFIT[0], medio: OUTFIT[1], semi: OUTFIT[2], negrito: OUTFIT[3] };

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
};

const PrototipoContext = createContext<Valor>({
  valores: INICIAIS,
  mudar: () => {},
  paleta: comLegado(TEMAS.escuro),
  escuro: true,
});

const ESTILO_FONTE = {
  '--fonte-400': OUTFIT[0],
  '--fonte-500': OUTFIT[1],
  '--fonte-600': OUTFIT[2],
  '--fonte-700': OUTFIT[3],
};

export function PrototipoProvider({ children }: { children: React.ReactNode }) {
  const [valores, setValores] = useState<Valores>(INICIAIS);
  const sistema = useColorScheme();
  const [fontesProntas, erroFontes] = useFonts({ Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold });

  const mudar = useCallback(<E extends Eixo>(eixo: E, valor: ValorDo<E>) => {
    setValores((v) => ({ ...v, [eixo]: valor }));
  }, []);

  const escuro = valores.tema === 'sistema' ? sistema !== 'light' : valores.tema === 'escuro';
  const cores = TEMAS[escuro ? 'escuro' : 'claro'];

  const valor = useMemo<Valor>(() => ({ valores, mudar, paleta: comLegado(cores), escuro }), [valores, mudar, cores, escuro]);
  const estilo = useMemo(() => vars({ ...variaveis(cores), ...ESTILO_FONTE }), [cores]);

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

/** Se a assinatura (elemento-diferencial) está ligada: ela mesma ou "Todas". */
export function useAssinatura(nome: 'ambiente' | 'fio' | 'diagonal'): boolean {
  const atual = useEixo('assinatura');
  return atual === nome || atual === 'todas';
}

export function usePaleta(): Paleta {
  return useContext(PrototipoContext).paleta;
}

export function useFontes(): Fontes {
  return FONTES;
}

/** Impacto leve, fixo, só ao salvar ou remover um Item. */
export function vibrarConfirmacao() {
  if (EM_TESTE) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
