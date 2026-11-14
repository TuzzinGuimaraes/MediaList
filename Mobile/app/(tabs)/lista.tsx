import { useState } from 'react';
import { Text } from 'react-native';

import { mensagemDeErro } from '@/api/erros';
import { useLista, useMudarProgresso } from '@/api/lista';
import { ResultadosDaBusca, useCabecalhoDeBusca } from '@/components/BuscaDaLista';
import { EditorItem } from '@/components/EditorItem';
import { Carregando, Falha } from '@/components/EstadoTela';
import type { AcoesDoItem } from '@/components/LinhaItem';
import { PaginasStatus } from '@/components/PaginasStatus';
import { SheetDaLista } from '@/components/SheetDaLista';
import type { ControleDosFiltros } from '@/components/SheetFiltros';
import type { EstadoConsumo } from '@/dominio/estadoConsumo';
import {
  buscarNaLista,
  FILTROS_PADRAO,
  type FiltrosLista,
  filtrosAtivos,
  filtrosEfetivos,
  filtrosRestringem,
  opcoesDosFiltros,
  organizarLista,
} from '@/dominio/filtrosLista';
import { ConteudoRecorte, TIPOS_DO_RECORTE, useRecorte } from '@/recorte/RecorteContext';

export default function Lista() {
  const { recorte } = useRecorte();
  const tipos = TIPOS_DO_RECORTE[recorte];
  const lista = useLista();
  const progresso = useMudarProgresso();
  const [estado, setEstado] = useState<EstadoConsumo>('em_progresso');
  const [filtros, setFiltros] = useState<FiltrosLista>(FILTROS_PADRAO);
  const [sheetAberto, setSheetAberto] = useState(false);
  // null: busca fechada (o cabeçalho mostra a lupa); texto: o campo no cabeçalho.
  const [busca, setBusca] = useState<string | null>(null);
  // Guarda só o id: o editor lê o Item atual da Lista.
  const [editando, setEditando] = useState<string | null>(null);

  useCabecalhoDeBusca(busca, setBusca);

  const acoes: AcoesDoItem = {
    editar: setEditando,
    mudarProgresso: (item, p) =>
      progresso.mutate({ idLista: item.id_lista, idMidia: item.id_midia, passo: p - (item.progresso_atual ?? 0) }),
  };

  let conteudo: React.ReactNode;
  if (lista.data) {
    const doRecorte = lista.data.filter((i) => (tipos as string[]).includes(i.tipo));
    const opcoes = opcoesDosFiltros(doRecorte);
    const efetivos = filtrosEfetivos(filtros, opcoes);
    const filtrados = organizarLista(doRecorte, efetivos);
    const emEdicao = lista.data.find((i) => i.id_lista === editando);
    const termo = busca?.trim() ?? '';
    const controle: ControleDosFiltros = {
      filtrado: filtrosRestringem(efetivos),
      ativos: filtrosAtivos(efetivos),
      abrir: () => setSheetAberto(true),
    };

    conteudo = (
      <>
        {progresso.isError ? (
          <Text accessibilityRole="alert" className="px-4 pb-2 pt-2 text-corpo text-erro">
            {mensagemDeErro(progresso.error)}
          </Text>
        ) : null}
        {termo ? (
          <ResultadosDaBusca itens={buscarNaLista(filtrados, termo)} termo={termo} filtros={controle} acoes={acoes} />
        ) : (
          <PaginasStatus
            // Trocar de catálogo muda o número de páginas: recomeça o pager.
            key={tipos.join()}
            itens={filtrados}
            tipos={tipos}
            estado={estado}
            escolher={setEstado}
            filtros={controle}
            acoes={acoes}
          />
        )}
        {sheetAberto ? (
          <SheetDaLista filtros={efetivos} opcoes={opcoes} mudar={setFiltros} aoFechar={() => setSheetAberto(false)} />
        ) : null}
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
