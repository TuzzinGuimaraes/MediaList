// Calendário da semana (ticket 50 da revisão), aba da Temporada atual: "A seguir dos seus", o
// filtro "Só os meus", o alternador Agenda | Semana, a faixa de dias e a visualização escolhida.
// Dias, horas, filtro e padrão vêm de dominio/calendario.ts; aqui só a apresentação.
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Fragment, useEffect, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { useCalendario } from '../api/calendario';
import { useLista } from '../api/lista';
import { useAgora } from '../calendario/agora';
import { fusoDoAparelho } from '../calendario/fuso';
import { useVistaDoCalendario } from '../calendario/vista';
import {
  aSeguirDosSeus,
  type ASeguir,
  avisoDaSemanaVazia,
  avisoDoDiaVazio,
  type DiaDoCalendario,
  diasDoCalendario,
  type EpisodioNoDia,
  marcadorDoAgora,
  notaDoHorario,
  rotuloDoChip,
  semanaVazia,
  soOsMeusPorPadrao,
  TEXTOS_DO_CALENDARIO as textos,
  TRAVA_DA_ROLAGEM_MS,
  type VistaDoCalendario,
  VISTAS_DO_CALENDARIO,
} from '@dominio/calendario';
import { contagemDeEpisodios, tituloDaMidia } from '@dominio/midia';
import type { EpisodioDoCalendario } from '@dominio/tipos';
import { rotaDaMidia } from '../rotas';
import { useCores } from '../tema/TemaContext';
import { Botao } from './Botao';
import { Carregando, Falha } from './EstadoTela';
import { Monograma } from './Monograma';
import { PlanejadoOuNaLista } from './PlanejadoOuNaLista';
import { Toque } from './Toque';

const ep = (n: number) => `Ep. ${n}`;

type Dia = DiaDoCalendario<EpisodioDoCalendario>;
type NoDia = EpisodioNoDia<EpisodioDoCalendario>;

/** A coluna da Semana ocupa esta fração da largura: a do lado aparece, e convida a rolar. */
const FRACAO_DA_COLUNA = 0.85;
const VAO_DA_COLUNA = 12;

export function Calendario() {
  const agora = useAgora();
  const [fuso] = useState(fusoDoAparelho);
  const calendario = useCalendario(agora, fuso);
  const lista = useLista();
  const [vista, escolherVista] = useVistaDoCalendario();
  const [escolhido, setEscolhido] = useState<boolean | null>(null);
  const [ativo, setAtivo] = useState(0);
  const { width } = useWindowDimensions();

  const pagina = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const trilho = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const travadoAte = useRef(0);
  const alturaDaFaixa = useRef(0);
  const topoDaAgenda = useRef(0);
  const topoDosDias = useRef<number[]>([]);

  if (calendario.isError) return <Falha erro={calendario.error} tentarDeNovo={() => calendario.refetch()} />;
  // O padrão do filtro depende da Lista: sem ela, a tela não abre com o filtro errado.
  const itens = lista.data ?? (lista.isError ? [] : null);
  if (!calendario.data || !itens) return <Carregando rotulo={textos.carregando} />;

  const episodios = calendario.data;
  // O padrão vale na abertura: pôr um anime em Planejado depois não liga o filtro sozinho.
  const soOsMeus = escolhido ?? soOsMeusPorPadrao(episodios, itens);
  if (escolhido === null) setEscolhido(soOsMeus);
  const dias = diasDoCalendario(episodios, { agora, fuso, itens, soOsMeus });
  const aSeguir = aSeguirDosSeus(episodios, { agora, fuso, itens });
  const naLista = lista.data ? new Set(lista.data.map((i) => i.id_midia)) : new Set<string>();
  const vazia = semanaVazia(dias);

  const larguraDaColuna = Math.round(width * FRACAO_DA_COLUNA);
  const passoDaColuna = larguraDaColuna + VAO_DA_COLUNA;

  const ir = (i: number) => {
    setAtivo(i);
    travadoAte.current = Date.now() + TRAVA_DA_ROLAGEM_MS;
    if (vista === 'agenda') {
      const y = topoDaAgenda.current + (topoDosDias.current[i] ?? 0) - alturaDaFaixa.current;
      pagina.current?.scrollTo({ y: Math.max(0, y), animated: true });
    } else {
      trilho.current?.scrollTo({ x: i * passoDaColuna, animated: true });
    }
  };

  // Agenda: o chip ativo acompanha a rolagem da página.
  const rolouAPagina = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (vista !== 'agenda' || Date.now() < travadoAte.current) return;
    const limite = e.nativeEvent.contentOffset.y + alturaDaFaixa.current + 24;
    let dia = 0;
    topoDosDias.current.forEach((topo, i) => {
      if (topoDaAgenda.current + topo <= limite) dia = i;
    });
    setAtivo(dia);
  };

  // Semana: o chip ativo é a coluna encaixada.
  const rolouOTrilho = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (Date.now() < travadoAte.current) return;
    setAtivo(Math.min(dias.length - 1, Math.max(0, Math.round(e.nativeEvent.contentOffset.x / passoDaColuna))));
  };

  const mudarVista = (nova: VistaDoCalendario) => {
    setAtivo(0);
    escolherVista(nova);
  };

  return (
    <ScrollView
      ref={pagina}
      onScroll={rolouAPagina}
      scrollEventThrottle={32}
      stickyHeaderIndices={[1]}
      contentContainerClassName="pb-8"
    >
      <View className="gap-3 px-4 pt-3">
        {aSeguir ? <BlocoASeguir aSeguir={aSeguir} /> : null}
        <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1">
          <View className="min-h-[44px] flex-row items-center gap-2">
            <FiltroSoOsMeus ligado={soOsMeus} mudar={setEscolhido} />
          </View>
          <Alternador vista={vista} mudar={mudarVista} />
          <Text className="w-full text-legenda text-texto-suave">{notaDoHorario(agora, fuso)}</Text>
        </View>
      </View>
      <View
        onLayout={(e) => {
          alturaDaFaixa.current = e.nativeEvent.layout.height;
        }}
        className="bg-fundo py-2"
      >
        {vazia ? null : <Faixa dias={dias} ativo={ativo} ir={ir} />}
      </View>
      {vazia ? (
        <SemanaVazia soOsMeus={soOsMeus} verTodos={() => setEscolhido(false)} />
      ) : vista === 'agenda' ? (
        <View
          onLayout={(e) => {
            topoDaAgenda.current = e.nativeEvent.layout.y;
          }}
          className="gap-6 px-4"
        >
          {dias.map((dia, i) => (
            <DiaDaAgenda
              key={dia.chave}
              dia={dia}
              agora={marcadorDoAgora(agora, fuso)}
              soOsMeus={soOsMeus}
              naLista={naLista}
              aoMedir={(y) => {
                topoDosDias.current[i] = y;
              }}
            />
          ))}
        </View>
      ) : (
        <ScrollView
          ref={trilho}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={passoDaColuna}
          decelerationRate="fast"
          disableIntervalMomentum
          onScroll={rolouOTrilho}
          scrollEventThrottle={32}
          contentContainerStyle={{ gap: VAO_DA_COLUNA, paddingHorizontal: 16, alignItems: 'flex-start' }}
        >
          {dias.map((dia, i) => (
            <ColunaDaSemana
              key={dia.chave}
              dia={dia}
              ativa={i === ativo}
              largura={larguraDaColuna}
              soOsMeus={soOsMeus}
              naLista={naLista}
            />
          ))}
        </ScrollView>
      )}
    </ScrollView>
  );
}

function Capa({ episodio, largura, altura }: { episodio: EpisodioDoCalendario; largura: number; altura: number }) {
  return (
    <View className="overflow-hidden rounded-sm bg-superficie-alta" style={{ width: largura, height: altura }}>
      {episodio.poster_url ? (
        <Image
          source={episodio.poster_url}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          cachePolicy="disk"
          recyclingKey={episodio.id_midia}
          accessibilityIgnoresInvertColors
        />
      ) : null}
    </View>
  );
}

function BlocoASeguir({ aSeguir }: { aSeguir: ASeguir<EpisodioDoCalendario> }) {
  const router = useRouter();
  const { episodio, dia, hora } = aSeguir;
  const titulo = tituloDaMidia(episodio);
  return (
    <Toque
      accessibilityRole="link"
      accessibilityLabel={`${textos.aSeguir}: ${titulo}, ${ep(episodio.episodio)}, ${dia}, ${hora}`}
      onPress={() => router.push(rotaDaMidia(episodio.id_midia))}
      className="flex-row items-center gap-3 rounded-lg border border-marca/30 bg-marca/15 p-3"
    >
      <Capa episodio={episodio} largura={56} altura={84} />
      <View className="flex-1 gap-0.5">
        <Text className="text-legenda font-bold uppercase text-marca-texto">{textos.aSeguir}</Text>
        <Text numberOfLines={2} className="text-corpo font-bold text-texto-forte">
          {titulo}
        </Text>
        <Text className="text-legenda text-texto">
          {ep(episodio.episodio)} · {dia}, {hora}
        </Text>
      </View>
    </Toque>
  );
}

function FiltroSoOsMeus({ ligado, mudar }: { ligado: boolean; mudar(ligado: boolean): void }) {
  const cores = useCores();
  return (
    <>
      <Switch
        accessibilityLabel={textos.soOsMeus}
        value={ligado}
        onValueChange={mudar}
        trackColor={{ true: cores.marca, false: cores.borda }}
        thumbColor={cores.superficie}
      />
      <Text className="text-corpo font-semibold text-texto-forte">{textos.soOsMeus}</Text>
    </>
  );
}

function Alternador({ vista, mudar }: { vista: VistaDoCalendario; mudar(vista: VistaDoCalendario): void }) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={textos.visualizacao}
      className="flex-row rounded-lg border border-borda p-0.5"
    >
      {VISTAS_DO_CALENDARIO.map(({ valor, nome }) => {
        const escolhida = valor === vista;
        return (
          <Pressable
            key={valor}
            accessibilityRole="radio"
            accessibilityLabel={nome}
            accessibilityState={{ checked: escolhida }}
            onPress={() => mudar(valor)}
            className={`min-h-[36px] justify-center rounded-md px-3 ${escolhida ? 'bg-superficie-alta' : ''}`}
          >
            <Text className={`text-legenda font-semibold ${escolhida ? 'text-texto-forte' : 'text-texto-suave'}`}>
              {nome}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Os chips dos dias, com nome, data e contagem; tocar leva ao dia. */
function Faixa({ dias, ativo, ir }: { dias: Dia[]; ativo: number; ir(i: number): void }) {
  const trilho = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const posicoes = useRef<number[]>([]);
  const { width } = useWindowDimensions();
  // Mantém o chip ativo visível.
  useEffect(() => {
    const x = posicoes.current[ativo];
    if (x !== undefined) trilho.current?.scrollTo({ x: Math.max(0, x - width / 3), animated: true });
  }, [ativo, width]);
  return (
    <ScrollView
      ref={trilho}
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      accessibilityLabel={textos.dias}
      contentContainerClassName="gap-2 px-4"
    >
      {dias.map((dia, i) => {
        const selecionado = i === ativo;
        return (
          <Pressable
            key={dia.chave}
            accessibilityRole="tab"
            accessibilityLabel={rotuloDoChip(dia)}
            accessibilityState={{ selected: selecionado }}
            onPress={() => ir(i)}
            onLayout={(e) => {
              posicoes.current[i] = e.nativeEvent.layout.x;
            }}
            className={`min-w-[64px] items-center rounded-xl border px-2.5 py-1.5 ${
              selecionado ? 'border-marca bg-marca' : 'border-borda'
            }`}
          >
            <Text
              className={`text-legenda font-bold ${
                selecionado ? 'text-sobre-marca' : dia.hoje ? 'text-marca-texto' : 'text-texto'
              }`}
            >
              {dia.curto}
            </Text>
            <Text className={`text-legenda ${selecionado ? 'text-sobre-marca' : 'text-texto-suave'}`}>{dia.data}</Text>
            <Text
              className={`text-corpo font-bold ${selecionado ? 'text-sobre-marca' : 'text-texto'} ${
                dia.total ? '' : 'opacity-40'
              }`}
            >
              {dia.total}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function DiaVazio({ soOsMeus }: { soOsMeus: boolean }) {
  return (
    <Text className="rounded-md border border-dashed border-borda px-3 py-5 text-center text-legenda text-texto-suave">
      {avisoDoDiaVazio(soOsMeus)}
    </Text>
  );
}

/** A semana inteira sem episódio: um aviso só; com o filtro ligado, o atalho para ver todos. */
function SemanaVazia({ soOsMeus, verTodos }: { soOsMeus: boolean; verTodos(): void }) {
  return (
    <View className="items-center gap-3 px-6 py-16">
      <Monograma tamanho={44} rotulo={null} />
      <Text className="text-center text-corpo text-texto-suave">{avisoDaSemanaVazia(soOsMeus)}</Text>
      {soOsMeus ? <Botao titulo={textos.verTodos} variante="secundario" onPress={verTodos} /> : null}
    </View>
  );
}

/** O link do episódio: o título, o "Ep. N", a hora e o "foi ao ar", para o leitor de tela. */
function rotuloDoEpisodio({ episodio, hora, foiAoAr }: NoDia): string {
  const rotulo = `${tituloDaMidia(episodio)}, ${ep(episodio.episodio)}, ${hora}`;
  return foiAoAr ? `${rotulo}, ${textos.foiAoAr}` : rotulo;
}

// ---------- Agenda ----------

function DiaDaAgenda({
  dia,
  agora,
  soOsMeus,
  naLista,
  aoMedir,
}: {
  dia: Dia;
  agora: Marcador;
  soOsMeus: boolean;
  naLista: Set<string>;
  aoMedir(y: number): void;
}) {
  // Em Hoje, o marcador "agora" fica antes do primeiro que ainda não foi ao ar.
  const iAgora = dia.hoje ? dia.episodios.findIndex((e) => !e.foiAoAr) : -2;
  return (
    <View accessibilityLabel={dia.rotulo} onLayout={(e) => aoMedir(e.nativeEvent.layout.y)} className="gap-2">
      <View className="flex-row items-baseline gap-2 py-1">
        <Text accessibilityRole="header" className="text-titulo-secao font-bold text-texto-forte">
          {dia.rotulo}
        </Text>
        <Text className="text-legenda text-texto-suave">{dia.data}</Text>
        <Text className="ml-auto text-legenda text-texto-suave">{dia.total ? contagemDeEpisodios(dia.total) : ''}</Text>
      </View>
      {dia.total === 0 ? (
        <DiaVazio soOsMeus={soOsMeus} />
      ) : (
        <View className="gap-1.5">
          {dia.episodios.map((noDia, i) => (
            <Fragment key={`${noDia.episodio.id_midia}-${noDia.episodio.episodio}`}>
              {i === iAgora ? <MarcadorAgora {...agora} /> : null}
              <LinhaDaAgenda noDia={noDia} naLista={naLista} />
            </Fragment>
          ))}
          {iAgora === -1 ? <MarcadorAgora {...agora} /> : null}
        </View>
      )}
    </View>
  );
}

type Marcador = ReturnType<typeof marcadorDoAgora>;

function MarcadorAgora({ hora, rotulo }: Marcador) {
  return (
    <View accessibilityLabel={rotulo} className="flex-row items-center gap-3 py-1">
      <Text className="w-14 text-right text-legenda font-bold text-marca-texto">{hora}</Text>
      <View className="h-2.5 w-2.5 rounded-full bg-marca" />
      <View className="h-[2px] flex-1 rounded-full bg-marca" />
      <Text className="text-legenda font-bold uppercase text-marca-texto">{textos.agora}</Text>
    </View>
  );
}

function LinhaDaAgenda({ noDia, naLista }: { noDia: NoDia; naLista: Set<string> }) {
  const router = useRouter();
  const { episodio, hora, foiAoAr } = noDia;
  const titulo = tituloDaMidia(episodio);
  return (
    <View className={`flex-row items-center gap-3 ${foiAoAr ? 'opacity-55' : ''}`}>
      <Text
        className="w-14 text-right text-corpo font-bold text-texto-forte"
        style={{ fontVariant: ['tabular-nums'] }}
      >
        {hora}
      </Text>
      <View className="flex-1 flex-row items-center gap-2 rounded-md bg-superficie p-2">
        <Toque
          accessibilityRole="link"
          accessibilityLabel={rotuloDoEpisodio(noDia)}
          onPress={() => router.push(rotaDaMidia(episodio.id_midia))}
          caixa={{ flex: 1 }}
          className="flex-row items-center gap-3"
        >
          <Capa episodio={episodio} largura={40} altura={56} />
          <View className="flex-1 gap-0.5">
            <Text numberOfLines={1} className="text-corpo font-semibold text-texto-forte">
              {titulo}
            </Text>
            <View className="flex-row items-center gap-2">
              <Text className="text-legenda text-texto-suave">{ep(episodio.episodio)}</Text>
              {foiAoAr ? (
                <Text className="rounded-sm border border-borda px-1.5 text-legenda font-semibold text-texto-suave">
                  {textos.foiAoAr}
                </Text>
              ) : null}
            </View>
          </View>
        </Toque>
        <PlanejadoOuNaLista
          idMidia={episodio.id_midia}
          tipo={episodio.tipo}
          titulo={titulo}
          naLista={naLista.has(episodio.id_midia)}
        />
      </View>
    </View>
  );
}

// ---------- Semana ----------

function ColunaDaSemana({
  dia,
  ativa,
  largura,
  soOsMeus,
  naLista,
}: {
  dia: Dia;
  ativa: boolean;
  largura: number;
  soOsMeus: boolean;
  naLista: Set<string>;
}) {
  return (
    <View
      accessibilityLabel={dia.rotulo}
      style={{ width: largura }}
      className={`gap-2 rounded-lg p-1.5 ${dia.hoje ? 'bg-marca/10' : 'bg-superficie/40'} ${
        ativa ? 'border-2 border-marca' : dia.hoje ? 'border border-marca/40' : ''
      }`}
    >
      <View className="flex-row items-baseline justify-between gap-1 px-1 pb-1 pt-0.5">
        <Text
          accessibilityRole="header"
          className={`text-corpo font-bold ${dia.hoje ? 'text-marca-texto' : 'text-texto-forte'}`}
        >
          {dia.rotulo}
        </Text>
        <Text className="text-legenda text-texto-suave">{dia.data}</Text>
      </View>
      {dia.total === 0 ? (
        <DiaVazio soOsMeus={soOsMeus} />
      ) : (
        dia.episodios.map((noDia) => (
          <BlocoDaSemana
            key={`${noDia.episodio.id_midia}-${noDia.episodio.episodio}`}
            noDia={noDia}
            naLista={naLista}
          />
        ))
      )}
    </View>
  );
}

function BlocoDaSemana({ noDia, naLista }: { noDia: NoDia; naLista: Set<string> }) {
  const router = useRouter();
  const { episodio, hora, foiAoAr } = noDia;
  const titulo = tituloDaMidia(episodio);
  return (
    <View
      className={`gap-1.5 rounded-md border-l-[3px] bg-superficie p-2 ${
        foiAoAr ? 'border-borda opacity-55' : 'border-marca'
      }`}
    >
      <Toque
        accessibilityRole="link"
        accessibilityLabel={rotuloDoEpisodio(noDia)}
        onPress={() => router.push(rotaDaMidia(episodio.id_midia))}
        className="gap-1.5"
      >
        <View className="flex-row items-center gap-2">
          <Capa episodio={episodio} largura={28} altura={40} />
          <View>
            <Text className="text-corpo font-bold text-texto-forte" style={{ fontVariant: ['tabular-nums'] }}>
              {hora}
            </Text>
            <Text className="text-legenda text-texto-suave">
              {ep(episodio.episodio)}
              {foiAoAr ? ` · ${textos.foiAoAr}` : ''}
            </Text>
          </View>
        </View>
        <Text numberOfLines={2} className="text-legenda font-semibold text-texto-forte">
          {titulo}
        </Text>
      </Toque>
      <View className="items-start">
        <PlanejadoOuNaLista
          idMidia={episodio.id_midia}
          tipo={episodio.tipo}
          titulo={titulo}
          naLista={naLista.has(episodio.id_midia)}
        />
      </View>
    </View>
  );
}
