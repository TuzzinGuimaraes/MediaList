import { useState } from 'react';
import { Text } from 'react-native';

import { mensagemDeErro } from '@/api/erros';
import { useLista, useMudarProgresso } from '@/api/lista';
import { EditorItem } from '@/components/EditorItem';
import { Carregando, Falha } from '@/components/EstadoTela';
import { ConteudoRecorte, TIPOS_DO_RECORTE, useRecorte } from '@/recorte/RecorteContext';
import { ListaPrototipo } from '@/prototipo/PrototipoLista';

// PROTÓTIPO (ticket 34): o layout (navegação por Status, anime × mangá, sugestões) fica em
// src/prototipo/PrototipoLista.tsx, trocado pela barra; aqui ficam os dados, o stepper e o editor.
export default function Lista() {
  const { recorte } = useRecorte();
  const tipos = TIPOS_DO_RECORTE[recorte];
  const lista = useLista();
  const progresso = useMudarProgresso();
  // Guarda só o id: o editor lê o Item atual da Lista.
  const [editando, setEditando] = useState<string | null>(null);

  let conteudo: React.ReactNode;
  if (lista.data) {
    const doRecorte = lista.data.filter((i) => (tipos as string[]).includes(i.tipo));
    const emEdicao = lista.data.find((i) => i.id_lista === editando);

    conteudo = (
      <>
        {progresso.isError ? (
          <Text accessibilityRole="alert" className="px-4 pb-2 pt-2 text-corpo text-accent-red">
            {mensagemDeErro(progresso.error)}
          </Text>
        ) : null}
        <ListaPrototipo
          itens={doRecorte}
          naLista={new Set(lista.data.map((i) => i.id_midia))}
          tipos={tipos}
          editar={setEditando}
          mudarProgresso={(item, p) =>
            progresso.mutate({ idLista: item.id_lista, idMidia: item.id_midia, passo: p - (item.progresso_atual ?? 0) })
          }
          atualizando={lista.isRefetching && !progresso.isPending}
          atualizar={() => void lista.refetch()}
        />
        {emEdicao ? <EditorItem midia={emEdicao} item={emEdicao} aoFechar={() => setEditando(null)} /> : null}
      </>
    );
  } else if (lista.isError) {
    conteudo = <Falha erro={lista.error} tentarDeNovo={() => lista.refetch()} />;
  } else {
    conteudo = <Carregando />;
  }

  return <ConteudoRecorte>{conteudo}</ConteudoRecorte>;
}
