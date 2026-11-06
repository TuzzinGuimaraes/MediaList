import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, TextInput, View } from 'react-native';

import { type Ordem, useBuscaMidias, useGeneros } from '@/api/explorar';
import type { TipoMidia } from '@/api/tipos';
import { CardMidia } from '@/components/CardMidia';
import { Carregando, Falha, Vazio } from '@/components/EstadoTela';
import { Opcoes } from '@/components/Opcoes';
import { SeletorRecorte } from '@/components/SeletorRecorte';
import { NOMES_TIPO } from '@/dominio/estadoConsumo';
import { TIPOS_DO_RECORTE, useRecorte } from '@/recorte/RecorteContext';
import paleta from '@/tema/paleta';

const textos = {
  busca: 'Buscar por título',
  tipo: 'Tipo de mídia',
  genero: 'Gênero',
  todosGeneros: 'Todos',
  ordem: 'Ordem',
  resultados: 'Resultados',
  nadaEncontrado: (termo: string) => `Nenhuma Mídia encontrada para "${termo}".`,
  nadaNoFiltro: 'Nenhuma Mídia com esses filtros.',
};

const ORDENS: { valor: Ordem; titulo: string }[] = [
  { valor: 'nota_media', titulo: 'Nota' },
  { valor: 'titulo', titulo: 'Título' },
  { valor: 'data_lancamento', titulo: 'Lançamento' },
  { valor: 'mais_adicionados', titulo: 'Mais adicionados' },
];

const COLUNAS = 3;
const ATRASO_BUSCA_MS = 300;
/** Como no web: um caractere só casaria quase tudo. */
const MINIMO_BUSCA = 2;

function useValorAtrasado<T>(valor: T, ms: number): T {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const espera = setTimeout(() => setAtrasado(valor), ms);
    return () => clearTimeout(espera);
  }, [valor, ms]);
  return atrasado;
}

export default function Explorar() {
  const { recorte } = useRecorte();
  const tipos = TIPOS_DO_RECORTE[recorte];
  const [tipoEscolhido, setTipoEscolhido] = useState<TipoMidia>(tipos[0]);
  const tipo = tipos.includes(tipoEscolhido) ? tipoEscolhido : tipos[0];
  // Gênero vale só para o Tipo em que foi escolhido: trocar Tipo ou Recorte o limpa.
  const [genero, setGenero] = useState<{ tipo: TipoMidia; nome: string } | null>(null);
  const nomeGenero = genero?.tipo === tipo ? genero.nome : null;
  const [ordem, setOrdem] = useState<Ordem>('nota_media');
  const [texto, setTexto] = useState('');
  const termo = useValorAtrasado(texto.trim(), ATRASO_BUSCA_MS);
  const busca = termo.length >= MINIMO_BUSCA ? termo : '';

  const generos = useGeneros(tipo);
  const resultados = useBuscaMidias({ tipo, ordem, genero: nomeGenero, busca });

  let conteudo: React.ReactNode;
  if (resultados.data?.length === 0) {
    conteudo = <Vazio mensagem={busca ? textos.nadaEncontrado(busca) : textos.nadaNoFiltro} />;
  } else if (resultados.data) {
    conteudo = (
      <FlatList
        accessibilityLabel={textos.resultados}
        data={resultados.data}
        numColumns={COLUNAS}
        keyExtractor={(m) => m.id_midia}
        renderItem={({ item }) => (
          <View className="flex-1 px-1.5" style={{ maxWidth: `${100 / COLUNAS}%` }}>
            <CardMidia midia={item} />
          </View>
        )}
        contentContainerClassName="gap-4 px-2.5 pb-6"
        keyboardDismissMode="on-drag"
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (resultados.hasNextPage && !resultados.isFetchingNextPage) resultados.fetchNextPage();
        }}
        ListFooterComponent={
          resultados.isFetchingNextPage ? <ActivityIndicator color={paleta.accent.blue} /> : undefined
        }
      />
    );
  } else if (resultados.isError) {
    conteudo = <Falha erro={resultados.error} tentarDeNovo={() => resultados.refetch()} />;
  } else {
    conteudo = <Carregando />;
  }

  return (
    <View className="flex-1 bg-dark-primary">
      <View className="gap-3 py-4">
        <View className="gap-3 px-4">
          <SeletorRecorte />
          <TextInput
            accessibilityLabel={textos.busca}
            placeholder={textos.busca}
            placeholderTextColor={paleta.text.secondary}
            value={texto}
            onChangeText={setTexto}
            autoCorrect={false}
            returnKeyType="search"
            className="rounded-md border border-dark-border bg-dark-tertiary px-3 py-2.5 text-text-bright"
          />
        </View>
        {tipos.length > 1 ? (
          <Opcoes
            rotulo={textos.tipo}
            opcoes={tipos.map((t) => ({ valor: t, titulo: NOMES_TIPO[t] }))}
            valor={tipo}
            escolher={setTipoEscolhido}
          />
        ) : null}
        <Opcoes
          rotulo={textos.genero}
          opcoes={[
            { valor: null, titulo: textos.todosGeneros },
            ...(generos.data ?? []).map((nome) => ({ valor: nome, titulo: nome })),
          ]}
          valor={nomeGenero}
          escolher={(nome) => setGenero(nome ? { tipo, nome } : null)}
        />
        <Opcoes rotulo={textos.ordem} opcoes={ORDENS} valor={ordem} escolher={setOrdem} />
      </View>
      {conteudo}
    </View>
  );
}
