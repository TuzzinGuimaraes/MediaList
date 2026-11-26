// Temporada de anime (ticket 49 da revisão): os animes de uma Temporada do Catálogo, abrindo na
// atual, e na atual a aba Calendário (ticket 50). Estação, ano, ordem e aba ficam nos parâmetros
// da rota, como no web.
import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLista } from '@/api/lista';
import { useAnimesDaTemporada, useTemporadaMaisAntiga } from '@/api/temporada';
import type { Midia } from '@/api/tipos';
import { useSessao } from '@/auth/SessaoContext';
import { Calendario } from '@/components/Calendario';
import { CartaoTemporada } from '@/components/CartaoTemporada';
import { Carregando, Falha, Vazio } from '@/components/EstadoTela';
import { Opcoes } from '@/components/Opcoes';
import { GrupoFiltro, SheetFiltros } from '@/components/SheetFiltros';
import { Toque } from '@/components/Toque';
import { Voltar } from '@/components/TopoDetalhe';
import {
  anterior,
  mesmaTemporada,
  NOMES_DA_ESTACAO,
  ordemDaTemporada,
  type OrdemTemporada,
  ORDENS_DA_TEMPORADA,
  proxima,
  rotuloDaTemporada,
  secoesDaTemporada,
  type Temporada,
  temporadaDe,
  temporadaDosParametros,
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
  abas: 'Temporada',
  animes: 'Animes',
  calendario: 'Calendário',
  vazio: (t: Temporada) => `Nenhum anime de ${rotuloDaTemporada(t)} no Catálogo.`,
};

/** As ordens no formato de `Opcoes`. */
const ORDENS = ORDENS_DA_TEMPORADA.map((o) => ({ valor: o.valor, titulo: o.rotulo }));

/** Fora das abas, a tela precisa do próprio guard: um deep link pode abrir sem sessão. */
export default function TelaTemporada() {
  const { sessao } = useSessao();
  if (sessao.estado === 'carregando') return <Carregando />;
  if (sessao.estado === 'anonima') return <Redirect href="/login" />;
  if (sessao.estado === 'troca_de_senha') return <Redirect href="/definir-senha" />;
  return <PaginaTemporada />;
}

type Parametros = { estacao?: string; ano?: string; ordem?: string; aba?: string };
type Aba = 'animes' | 'calendario';

function PaginaTemporada() {
  const router = useRouter();
  const parametros = useLocalSearchParams<Parametros>();
  const [agora] = useState(() => new Date());
  const atual = useMemo(() => temporadaDe(agora), [agora]);
  const temporada = temporadaDosParametros(parametros, agora);
  const ordem = ordemDaTemporada(parametros.ordem);
  const [seletorAberto, setSeletorAberto] = useState(false);

  const maisAntiga = useTemporadaMaisAntiga();
  const seletor = useMemo(() => temporadasDoSeletor(maisAntiga.data ?? null, agora), [maisAntiga.data, agora]);
  // Fora do seletor (link para antes da mais antiga), as duas setas andam.
  const posicao = seletor.findIndex((t) => mesmaTemporada(t, temporada));
  const ehAtual = mesmaTemporada(temporada, atual);
  // O Calendário é só da Temporada atual: nas outras, a aba não existe.
  const aba: Aba = ehAtual && parametros.aba === 'calendario' ? 'calendario' : 'animes';

  const ir = (t: Temporada) => router.setParams({ estacao: t.estacao, ano: String(t.ano) });
  const voltar = () => (router.canGoBack() ? router.back() : router.replace('/explorar'));

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
        {ehAtual ? <Abas aba={aba} escolher={(a) => router.setParams({ aba: a })} /> : null}
        {aba === 'animes' ? (
          <View className="flex-row items-center">
            <View className="flex-1">
              <Opcoes
                rotulo={textos.ordem}
                opcoes={ORDENS}
                valor={ordem}
                escolher={(o) => router.setParams({ ordem: o })}
              />
            </View>
            {ehAtual ? null : (
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
        ) : null}
      </View>
      <View className="flex-1">
        {aba === 'calendario' ? (
          <Calendario />
        ) : (
          <AnimesDaTemporada temporada={temporada} ordem={ordem} />
        )}
      </View>
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

function Abas({ aba, escolher }: { aba: Aba; escolher: (aba: Aba) => void }) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel={textos.abas} className="flex-row gap-6 px-4">
      {(['animes', 'calendario'] as const).map((a) => {
        const ativa = a === aba;
        return (
          <Pressable
            key={a}
            accessibilityRole="tab"
            accessibilityLabel={textos[a]}
            accessibilityState={{ selected: ativa }}
            onPress={() => escolher(a)}
            className="min-h-[44px] justify-center"
          >
            <Text className={`text-corpo font-semibold ${ativa ? 'text-texto-forte' : 'text-texto-suave'}`}>
              {textos[a]}
            </Text>
            <View className={`h-[3px] rounded-full ${ativa ? 'bg-marca' : ''}`} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** A grade da Temporada: as séries e, à parte, os filmes e especiais. */
function AnimesDaTemporada({ temporada, ordem }: { temporada: Temporada; ordem: OrdemTemporada }) {
  const animes = useAnimesDaTemporada(temporada, ordem);
  const lista = useLista();
  const naLista = useMemo(
    () => (lista.data ? new Set(lista.data.map((i) => i.id_midia)) : lista.isError ? new Set<string>() : null),
    [lista.data, lista.isError],
  );

  if (!animes.data) {
    return animes.isError ? <Falha erro={animes.error} tentarDeNovo={() => animes.refetch()} /> : <Carregando />;
  }
  if (animes.data.length === 0) return <Vazio mensagem={textos.vazio(temporada)} />;
  const { principal, filmesEEspeciais } = secoesDaTemporada(animes.data);
  const cartao = (anime: Midia) => (
    <CartaoTemporada key={anime.id_midia} anime={anime} naLista={naLista ? naLista.has(anime.id_midia) : undefined} />
  );
  return (
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
