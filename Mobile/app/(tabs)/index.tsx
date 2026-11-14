import { FlatList, RefreshControl, ScrollView, Text, View } from 'react-native';

import { useCarrosseisPorGenero, useCarrossel } from '@/api/inicio';
import { useLista } from '@/api/lista';
import { useEmAlta, usePopulares } from '@/api/midias';
import type { CartaoMidia, ItemLista } from '@/api/tipos';
import { CardInfo, CardMidia } from '@/components/CardMidia';
import { Destaques } from '@/components/Destaques';
import { Carregando, Falha, Vazio } from '@/components/EstadoTela';
import { TituloSecao } from '@/components/Secao';
import { useAtualizar } from '@/components/useAtualizar';
import { estadoDe } from '@/dominio/estadoConsumo';
import { generosQueVoceCurte, jaLancadas, rotuloMaisConcluidos } from '@/dominio/inicio';
import { ConteudoRecorte, TIPOS_DO_RECORTE, useRecorte } from '@/recorte/RecorteContext';

const textos = {
  vazio: 'Nenhuma Mídia neste catálogo ainda.',
  continuar: 'Continuar',
  emAlta: 'Em alta',
  // Populares é acumulado (Usuários com a Mídia na Lista), não do dia.
  top10: 'Top 10',
  maioresNotas: 'Maiores notas',
  lancamentos: 'Lançamentos recentes',
  porGenero: (genero: string) => `Porque você curte ${genero}`,
  maisAdicionados: 'Mais adicionados',
};

const MAX_DESTAQUES = 5;
const LARGURA_CARD = 115;
const LARGURA_CONTINUAR = 290;

/** As Mídias da lista que não estão em `ja` (outro carrossel com a mesma ordem no backend). */
function sem<M extends CartaoMidia>(midias: M[] | undefined, ja: CartaoMidia[] | undefined): M[] {
  const ids = new Set(ja?.map((m) => m.id_midia));
  return (midias ?? []).filter((m) => !ids.has(m.id_midia));
}

/** Fileira do Início: título e carrossel horizontal; sem itens, não aparece. */
function Fileira<T>({
  titulo,
  itens,
  chave,
  renderizar,
  espaco = 'gap-3',
}: {
  titulo: string;
  itens: T[];
  chave(item: T): string;
  renderizar(item: T, indice: number): React.ReactElement;
  espaco?: string;
}) {
  if (!itens.length) return null;
  return (
    <View accessibilityLabel={titulo} className="gap-3">
      <TituloSecao className="px-4">{titulo}</TituloSecao>
      <FlatList
        horizontal
        data={itens}
        keyExtractor={chave}
        renderItem={({ item, index }) => renderizar(item, index)}
        contentContainerClassName={`${espaco} px-4`}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}

/** Carrossel de catálogo: card A. */
function Carrossel({ titulo, midias }: { titulo: string; midias: CartaoMidia[] }) {
  return (
    <Fileira
      titulo={titulo}
      itens={midias}
      chave={(m) => m.id_midia}
      renderizar={(m) => <CardMidia midia={m} largura={LARGURA_CARD} />}
    />
  );
}

/** Top 10 com o numeral grande ao lado do pôster. */
function Top10({ midias }: { midias: CartaoMidia[] }) {
  return (
    <Fileira
      titulo={textos.top10}
      itens={midias}
      chave={(m) => m.id_midia}
      espaco="gap-1"
      renderizar={(m, i) => (
        <View className="flex-row items-end">
          <Text
            importantForAccessibility="no"
            className="font-bold text-texto-suave/40"
            style={{ fontSize: 104, lineHeight: 104, marginRight: -14, letterSpacing: -6 }}
          >
            {i + 1}
          </Text>
          <CardMidia midia={m} largura={LARGURA_CARD - 11} />
        </View>
      )}
    />
  );
}

export default function Inicio() {
  const { recorte } = useRecorte();
  const tipos: string[] = TIPOS_DO_RECORTE[recorte];
  const emAlta = useEmAlta(recorte);
  const populares = usePopulares(recorte);
  const lista = useLista();
  const maioresNotas = useCarrossel(recorte, 'nota_media');
  const lancamentos = useCarrossel(recorte, 'data_lancamento');
  const maisAdicionados = useCarrossel(recorte, 'mais_adicionados');
  const maisConcluidos = useCarrossel(recorte, 'mais_concluidos');

  // Sem a Lista (ainda carregando), os gêneros esperam: senão sairiam os das populares e trocariam.
  const itens: ItemLista[] | undefined = lista.data ?? (lista.isError ? [] : undefined);
  const itensDoRecorte = itens?.filter((i) => tipos.includes(i.tipo));
  const generos =
    itensDoRecorte && populares.data ? generosQueVoceCurte(itensDoRecorte, populares.data) : [];
  const porGenero = useCarrosseisPorGenero(recorte, generos);

  const atualizar = useAtualizar([
    emAlta,
    populares,
    lista,
    maioresNotas,
    lancamentos,
    maisAdicionados,
    maisConcluidos,
    ...porGenero,
  ]);

  let conteudo: React.ReactNode;
  if (emAlta.data && populares.data) {
    const top10 = populares.data.slice(0, 10);
    const continuar = (itensDoRecorte ?? []).filter((i) => estadoDe(i.status_consumo, i.tipo) === 'em_progresso');
    const carrosseis = {
      maioresNotas: sem(maioresNotas.data, emAlta.data),
      lancamentos: jaLancadas(lancamentos.data ?? []),
      porGenero: generos.map((genero, i) => ({ genero, midias: sem(porGenero[i]?.data, itens) })),
      maisAdicionados: sem(maisAdicionados.data, top10),
      maisConcluidos: maisConcluidos.data ?? [],
    };
    // O estado vazio da tela só quando todos os carrosséis (já respondidos) vierem vazios.
    const pendente = [lista, maioresNotas, lancamentos, maisAdicionados, maisConcluidos, ...porGenero].some(
      (c) => c.isPending,
    );
    const vazio =
      !pendente &&
      [
        emAlta.data,
        top10,
        continuar,
        carrosseis.maioresNotas,
        carrosseis.lancamentos,
        carrosseis.maisAdicionados,
        carrosseis.maisConcluidos,
        ...carrosseis.porGenero.map((g) => g.midias),
      ].every((l) => !l.length);
    conteudo = vazio ? (
      <Vazio mensagem={textos.vazio} />
    ) : (
      <>
        {emAlta.data.length ? <Destaques midias={emAlta.data.slice(0, MAX_DESTAQUES)} /> : null}
        <Fileira
          titulo={textos.continuar}
          itens={continuar}
          chave={(i) => i.id_lista}
          renderizar={(i) => <CardInfo midia={i} largura={LARGURA_CONTINUAR} />}
        />
        <Carrossel titulo={textos.emAlta} midias={emAlta.data} />
        <Top10 midias={top10} />
        <Carrossel titulo={textos.maioresNotas} midias={carrosseis.maioresNotas} />
        <Carrossel titulo={textos.lancamentos} midias={carrosseis.lancamentos} />
        {carrosseis.porGenero.map(({ genero, midias }) => (
          <Carrossel key={genero} titulo={textos.porGenero(genero)} midias={midias} />
        ))}
        <Carrossel titulo={textos.maisAdicionados} midias={carrosseis.maisAdicionados} />
        <Carrossel titulo={rotuloMaisConcluidos(TIPOS_DO_RECORTE[recorte])} midias={carrosseis.maisConcluidos} />
      </>
    );
  } else if (emAlta.isError || populares.isError) {
    conteudo = <Falha erro={emAlta.error ?? populares.error} tentarDeNovo={atualizar.onRefresh} />;
  } else {
    conteudo = <Carregando />;
  }

  return (
    <ConteudoRecorte>
      <ScrollView
        testID="inicio"
        className="flex-1 bg-fundo"
        contentContainerClassName="flex-grow gap-7 pb-8 pt-4"
        refreshControl={<RefreshControl {...atualizar} />}
      >
        {conteudo}
      </ScrollView>
    </ConteudoRecorte>
  );
}
