import { useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';

import { mensagemDeErro } from '@/api/erros';
import { useLista, useMudarProgresso } from '@/api/lista';
import type { ItemLista } from '@/api/tipos';
import { EditorItem } from '@/components/EditorItem';
import { Carregando, Falha } from '@/components/EstadoTela';
import { LinhaItem } from '@/components/LinhaItem';
import { Opcoes } from '@/components/Opcoes';
import { contarPorEstado, type EstadoConsumo, NOMES_ESTADO } from '@/dominio/estadoConsumo';
import { estadosDaLista, itensDoEstado } from '@/dominio/itemLista';
import { ConteudoRecorte, TIPOS_DO_RECORTE, useRecorte } from '@/recorte/RecorteContext';
import paleta from '@/tema/paleta';

const textos = {
  abas: 'Estados de consumo',
  itens: 'Itens da Lista',
  vazio: (estado: string) => `Nenhum Item em ${estado}.`,
};

export default function Lista() {
  const { recorte } = useRecorte();
  const tipos = TIPOS_DO_RECORTE[recorte];
  const lista = useLista();
  const progresso = useMudarProgresso();
  const [estado, setEstado] = useState<EstadoConsumo>('em_progresso');
  // Guarda só o id: o editor lê o Item atual da Lista.
  const [editando, setEditando] = useState<string | null>(null);

  const estados = estadosDaLista(tipos);
  const aba = estados.includes(estado) ? estado : estados[0];

  let conteudo: React.ReactNode;
  if (lista.data) {
    const doRecorte = lista.data.filter((i) => (tipos as string[]).includes(i.tipo));
    const contagem = contarPorEstado(doRecorte);
    const itens = itensDoEstado(doRecorte, aba);
    const emEdicao = lista.data.find((i) => i.id_lista === editando);

    conteudo = (
      <>
        <View className="pb-2 pt-3">
          <Opcoes
            rotulo={textos.abas}
            opcoes={estados.map((e) => ({ valor: e, titulo: `${NOMES_ESTADO[e]} (${contagem[e]})` }))}
            valor={aba}
            escolher={setEstado}
          />
        </View>
        {progresso.isError ? (
          <Text accessibilityRole="alert" className="px-4 pb-2 text-corpo text-accent-red">
            {mensagemDeErro(progresso.error)}
          </Text>
        ) : null}
        <FlatList<ItemLista>
          accessibilityLabel={textos.itens}
          data={itens}
          keyExtractor={(i) => i.id_lista}
          renderItem={({ item }) => (
            <LinhaItem
              item={item}
              editar={() => setEditando(item.id_lista)}
              mudarProgresso={(p) =>
                progresso.mutate({ idLista: item.id_lista, idMidia: item.id_midia, passo: p - (item.progresso_atual ?? 0) })
              }
            />
          )}
          ItemSeparatorComponent={() => <View className="mx-4 h-px bg-dark-border" />}
          ListEmptyComponent={
            <Text className="p-6 text-center text-corpo text-text-secondary">{textos.vazio(NOMES_ESTADO[aba])}</Text>
          }
          refreshControl={
            <RefreshControl
              refreshing={lista.isRefetching && !progresso.isPending}
              onRefresh={() => void lista.refetch()}
              tintColor={paleta.accent.blue}
            />
          }
          contentContainerClassName="pb-6"
        />
        {emEdicao ? <EditorItem midia={emEdicao} item={emEdicao} aoFechar={() => setEditando(null)} /> : null}
      </>
    );
  } else if (lista.isError) {
    conteudo = <Falha erro={lista.error} tentarDeNovo={() => lista.refetch()} />;
  } else {
    conteudo = <Carregando />;
  }

  return (
    <ConteudoRecorte>
      {conteudo}
    </ConteudoRecorte>
  );
}
