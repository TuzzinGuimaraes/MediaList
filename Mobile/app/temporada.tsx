// Temporada de anime (ticket 49 da revisão): os animes de uma Temporada do Catálogo, abrindo na
// atual. Estação, ano e ordem ficam nos parâmetros da rota, como no web.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLista } from '@/api/lista';
import { type OrdemTemporada, useAnimesDaTemporada, useTemporadaMaisAntiga } from '@/api/temporada';
import type { Midia } from '@/api/tipos';
import { useSessao } from '@/auth/SessaoContext';
import { CartaoTemporada } from '@/components/CartaoTemporada';
import { Carregando, Falha, Vazio } from '@/components/EstadoTela';
import { Opcoes } from '@/components/Opcoes';
import { GrupoFiltro, SheetFiltros } from '@/components/SheetFiltros';
import { Toque } from '@/components/Toque';
import { Voltar } from '@/components/TopoDetalhe';
import {
  ESTACOES,
  type Estacao,
  anterior,
  mesmaTemporada,
  NOMES_DA_ESTACAO,
  proxima,
  rotuloDaTemporada,
  secoesDaTemporada,
  type Temporada,
  temporadaDe,
  temporadasDoSeletor,
  TITULO_FILMES_E_ESPECIAIS,
} from '@dominio/temporada';
import { useCores } from '@/tema/TemaContext';

const textos = {
  titulo: 'Temporada',
  anterior: (t: Temporada) => `Anterior, ${rotuloDaTemporada(t)}`,
  proxima: (t: Temporada) => `Próxima, ${rotuloDaTemporada(t)}`,
  escolher: (t: Temporada) => `Escolher temporada, ${rotuloDaTemporada(t)}`,
  atual: 'Atual',
  temporadaAtual: 'Temporada atual',
  ordem: 'Ordem',
  ano: 'Ano',
  estacao: 'Estação',
  series: 'Séries',
  vazio: (t: Temporada) => `Nenhum anime de ${rotuloDaTemporada(t)} no Catálogo.`,
};

const ORDEM_PADRAO: OrdemTemporada = 'popularidade_fonte';
const ORDENS: { valor: OrdemTemporada; titulo: string }[] = [
  { valor: 'popularidade_fonte', titulo: 'Mais esperados' },
  { valor: 'estreia', titulo: 'Estreia' },
  { valor: 'nota_media', titulo: 'Nota da fonte' },
];

/** Fora das abas, a tela precisa do próprio guard: um deep link pode abrir sem sessão. */
export default function TelaTemporada() {
  const { sessao } = useSessao();
  if (sessao.estado === 'carregando') return <Carregando />;
  if (sessao.estado === 'anonima') return <Redirect href="/login" />;
  if (sessao.estado === 'troca_de_senha') return <Redirect href="/definir-senha" />;
  return <PaginaTemporada />;
}

type Parametros = { estacao?: string; ano?: string; ordem?: string };

/** A Temporada do link, se vier inteira e válida; senão, a atual. */
function temporadaDosParametros(p: Parametros, atual: Temporada): Temporada {
  const ano = Number(p.ano);
  return ESTACOES.includes(p.estacao as Estacao) && Number.isInteger(ano)
    ? { estacao: p.estacao as Estacao, ano }
    : atual;
}

function PaginaTemporada() {
  const router = useRouter();
  const parametros = useLocalSearchParams<Parametros>();
  const [agora] = useState(() => new Date());
  const atual = useMemo(() => temporadaDe(agora), [agora]);
  const temporada = temporadaDosParametros(parametros, atual);
  const ordem = ORDENS.find((o) => o.valor === parametros.ordem)?.valor ?? ORDEM_PADRAO;
  const [seletorAberto, setSeletorAberto] = useState(false);

  const maisAntiga = useTemporadaMaisAntiga();
  const seletor = useMemo(() => temporadasDoSeletor(maisAntiga.data ?? null, agora), [maisAntiga.data, agora]);
  // Fora do seletor (link para antes da mais antiga), as duas setas andam.
  const posicao = seletor.findIndex((t) => mesmaTemporada(t, temporada));
  const animes = useAnimesDaTemporada(temporada, ordem);
  const lista = useLista();
  const naLista = useMemo(
    () => (lista.data ? new Set(lista.data.map((i) => i.id_midia)) : lista.isError ? new Set<string>() : null),
    [lista.data, lista.isError],
  );

  const ir = (t: Temporada) => router.setParams({ estacao: t.estacao, ano: String(t.ano) });
  const voltar = () => (router.canGoBack() ? router.back() : router.replace('/explorar'));

  let conteudo: React.ReactNode;
  if (animes.data?.length === 0) {
    conteudo = <Vazio mensagem={textos.vazio(temporada)} />;
  } else if (animes.data) {
    const { principal, filmesEEspeciais } = secoesDaTemporada(animes.data);
    const cartao = (anime: Midia) => (
      <CartaoTemporada key={anime.id_midia} anime={anime} naLista={naLista ? naLista.has(anime.id_midia) : undefined} />
    );
    conteudo = (
      <ScrollView contentContainerClassName="gap-6 px-4 pb-8 pt-3">
        {principal.length ? (
          <View accessibilityLabel={textos.series} className="gap-2.5">
            {principal.map(cartao)}
          </View>
        ) : null}
        {filmesEEspeciais.length ? (
          <View accessibilityLabel={TITULO_FILMES_E_ESPECIAIS} className="gap-2.5">
            <Text accessibilityRole="header" className="text-titulo-secao font-bold text-texto-forte">
              {TITULO_FILMES_E_ESPECIAIS}
            </Text>
            {filmesEEspeciais.map(cartao)}
          </View>
        ) : null}
      </ScrollView>
    );
  } else if (animes.isError) {
    conteudo = <Falha erro={animes.error} tentarDeNovo={() => animes.refetch()} />;
  } else {
    conteudo = <Carregando />;
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-fundo">
      <Voltar aoVoltar={voltar} />
      <View className="gap-3 border-b border-borda py-3">
        <View className="flex-row items-center gap-2 px-4">
          <Seta
            icone="chevron-back"
            rotulo={textos.anterior(anterior(temporada))}
            desligada={posicao === 0}
            onPress={() => ir(anterior(temporada))}
          />
          <Toque
            accessibilityRole="button"
            accessibilityLabel={textos.escolher(temporada)}
            onPress={() => setSeletorAberto(true)}
            caixa={{ flex: 1 }}
            className="min-h-[44px] flex-row items-center justify-center gap-1.5 rounded-md border border-borda bg-superficie-alta px-3"
          >
            <Text accessibilityRole="header" className="text-titulo-secao font-bold text-texto-forte">
              {rotuloDaTemporada(temporada)}
            </Text>
            <IconeSuave nome="chevron-down" />
          </Toque>
          <Seta
            icone="chevron-forward"
            rotulo={textos.proxima(proxima(temporada))}
            desligada={posicao === seletor.length - 1}
            onPress={() => ir(proxima(temporada))}
          />
        </View>
        <View className="flex-row items-center">
          <View className="flex-1">
            <Opcoes
              rotulo={textos.ordem}
              opcoes={ORDENS}
              valor={ordem}
              escolher={(o) => router.setParams({ ordem: o })}
            />
          </View>
          {mesmaTemporada(temporada, atual) ? null : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={textos.temporadaAtual}
              onPress={() => ir(atual)}
              hitSlop={6}
              className="mr-4 rounded-full border border-marca-texto px-3 py-1.5"
            >
              <Text className="text-corpo font-semibold text-marca-texto">{textos.atual}</Text>
            </Pressable>
          )}
        </View>
      </View>
      <View className="flex-1">{conteudo}</View>
      {seletorAberto ? (
        <SeletorTemporada
          temporadas={seletor}
          temporada={temporada}
          escolher={ir}
          aoFechar={() => setSeletorAberto(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}

function IconeSuave({ nome }: { nome: 'chevron-down' }) {
  const cores = useCores();
  return <Ionicons name={nome} size={18} color={cores['texto-suave']} />;
}

function Seta({
  icone,
  rotulo,
  desligada,
  onPress,
}: {
  icone: 'chevron-back' | 'chevron-forward';
  rotulo: string;
  desligada: boolean;
  onPress: () => void;
}) {
  const cores = useCores();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ disabled: desligada }}
      disabled={desligada}
      onPress={onPress}
      hitSlop={4}
      className={`h-11 w-11 items-center justify-center rounded-md border border-borda ${desligada ? 'opacity-40' : ''}`}
    >
      <Ionicons name={icone} size={20} color={cores.texto} />
    </Pressable>
  );
}

/**
 * O seletor livre: ano (da Temporada mais antiga do Catálogo até 4 à frente da atual) e a estação
 * daquele ano. Trocar o ano mantém a estação quando ela existe nele; senão, vai à mais próxima.
 */
function SeletorTemporada({
  temporadas,
  temporada,
  escolher,
  aoFechar,
}: {
  temporadas: Temporada[];
  temporada: Temporada;
  escolher: (t: Temporada) => void;
  aoFechar: () => void;
}) {
  const anos = [...new Set(temporadas.map((t) => t.ano))].reverse();
  const doAno = (ano: number) => temporadas.filter((t) => t.ano === ano);
  const trocarAno = (ano: number) => {
    const opcoes = doAno(ano);
    const mesma = opcoes.find((t) => t.estacao === temporada.estacao);
    const alvo = mesma ?? (ano > temporada.ano ? opcoes[0] : opcoes.at(-1));
    if (alvo) escolher(alvo);
  };
  return (
    <SheetFiltros titulo={textos.titulo} aoFechar={aoFechar}>
      <GrupoFiltro
        rotulo={textos.ano}
        opcoes={anos.map((ano) => ({ valor: ano, titulo: String(ano) }))}
        valor={temporada.ano}
        escolher={trocarAno}
      />
      <GrupoFiltro
        rotulo={textos.estacao}
        opcoes={doAno(temporada.ano).map((t) => ({ valor: t.estacao, titulo: NOMES_DA_ESTACAO[t.estacao] }))}
        valor={temporada.estacao}
        escolher={(estacao) => escolher({ estacao, ano: temporada.ano })}
      />
    </SheetFiltros>
  );
}
