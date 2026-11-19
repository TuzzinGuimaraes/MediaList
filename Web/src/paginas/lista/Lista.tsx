// Minha Lista (Resolutions do 19 e do 34): abas por Status com contagem, título colorido da
// aba, subseções Anime/Mangá, cards compactos em grade auto-fill e "Sugestões para você".
// Filtros e Ordem valem para todos os Status (as contagens refletem o filtro); a busca
// procura em todos os Status e troca as abas por uma lista única de resultados.
import { useState } from 'react';

import { contarPorEstado, type EstadoConsumo } from '@dominio/estadoConsumo';
import {
  buscarNaLista,
  FILTROS_PADRAO,
  type FiltrosLista,
  filtrosAtivos,
  filtrosEfetivos,
  filtrosRestringem,
  opcoesDosFiltros,
  organizarLista,
} from '@dominio/filtrosLista';
import { estadosDaLista, itensDoEstado } from '@dominio/itemLista';

import { mensagemDeErro } from '../../api/erros';
import { useCatalogo } from '../../catalogo/CatalogoContext';
import { Carregando, ErroTela, Vazio } from '../../componentes/Estados';
import { Icone } from '../../componentes/Icone';
import { ALTURA_NAV } from '../../layout/Casca';
import { AbasStatus } from './AbasStatus';
import { useLista, useMudarProgresso } from './api';
import { CampoBusca } from './CampoBusca';
import type { AcoesDoItem } from './CardItem';
import { useEditorItem } from './EditorItemContext';
import { FiltrosDaLista } from './FiltrosDaLista';
import { GradeItens } from './GradeItens';
import { PainelStatus } from './PainelStatus';
import { Sugestoes } from './Sugestoes';
import { textos } from './textos';

export function Lista() {
  const { tipos } = useCatalogo();
  const lista = useLista();
  const progresso = useMudarProgresso();
  const { abrirEditor } = useEditorItem();
  const [aba, setAba] = useState<EstadoConsumo>('em_progresso');
  const [filtros, setFiltros] = useState<FiltrosLista>(FILTROS_PADRAO);
  const [painel, setPainel] = useState(false);
  // null: busca fechada (só a lupa); texto: o campo aberto.
  const [busca, setBusca] = useState<string | null>(null);

  if (lista.isError) return <ErroTela erro={lista.error} tentarDeNovo={() => void lista.refetch()} />;
  if (!lista.data) return <Carregando rotulo="Carregando a Lista" />;

  const acoes: AcoesDoItem = {
    editar: (item) => abrirEditor(item, item),
    passo: (item, passo) => progresso.mutate({ idLista: item.id_lista, idMidia: item.id_midia, passo }),
  };

  const doCatalogo = lista.data.filter((i) => tipos.includes(i.tipo));
  const opcoes = opcoesDosFiltros(doCatalogo);
  const efetivos = filtrosEfetivos(filtros, opcoes);
  const organizados = organizarLista(doCatalogo, efetivos);
  const estados = estadosDaLista(tipos);
  // Trocar para Jogos some com abas e traz Platinado: a aba que não existe volta à primeira.
  const ativa = estados.includes(aba) ? aba : (estados[0] ?? 'em_progresso');
  const contagem = contarPorEstado(organizados);
  const daAba = itensDoEstado(organizados, ativa);
  const termo = busca?.trim() ?? '';
  const resultados = termo ? buscarNaLista(organizados, termo) : [];
  const ativos = filtrosAtivos(efetivos);

  return (
    <div className="pb-24">
      <div style={{ top: ALTURA_NAV }} className="sticky z-30 border-b border-borda bg-fundo/95 px-12 pt-8 backdrop-blur">
        <div className="flex items-center gap-4">
          <h1 className="text-[28px] font-bold text-texto-forte">{textos.titulo}</h1>
          <span className="text-texto-suave">{textos.itens(doCatalogo.length)}</span>
          <div className="ml-auto flex items-center gap-3">
            <CampoBusca valor={busca} mudar={setBusca} />
            <button
              type="button"
              onClick={() => setPainel(true)}
              aria-label={ativos ? textos.filtrosAtivos(ativos) : textos.filtros}
              className="flex h-11 items-center gap-2 rounded-md border border-borda px-3 text-[14px] font-semibold text-texto-forte hover:bg-superficie-alta"
            >
              <Icone nome="filtro" tamanho={16} /> {textos.filtros}
              {ativos ? (
                <span aria-hidden className="rounded-full bg-marca px-1.5 text-[12px] font-bold text-sobre-marca">
                  {ativos}
                </span>
              ) : null}
            </button>
          </div>
        </div>
        {termo ? (
          <p role="status" className="py-4 text-[14px] text-texto-suave">
            {textos.resultados(resultados.length, termo)}
          </p>
        ) : (
          <AbasStatus estados={estados} contagem={contagem} ativa={ativa} escolher={setAba} />
        )}
      </div>

      {progresso.isError ? (
        <p role="alert" className="px-12 pt-4 text-[14px] text-erro">
          {mensagemDeErro(progresso.error)}
        </p>
      ) : null}

      <div className="flex flex-col gap-6 px-12 pt-6">
        {termo ? (
          resultados.length ? (
            <section aria-label="Resultados da busca">
              <GradeItens itens={resultados} acoes={acoes} comStatus />
            </section>
          ) : (
            <Vazio texto={textos.semResultado} />
          )
        ) : (
          <PainelStatus
            estado={ativa}
            total={contagem[ativa]}
            itens={daAba}
            tipos={tipos}
            acoes={acoes}
            filtrado={filtrosRestringem(efetivos)}
          />
        )}
      </div>

      <Sugestoes lista={lista.data} />

      <FiltrosDaLista aberto={painel} fechar={() => setPainel(false)} filtros={efetivos} opcoes={opcoes} mudar={setFiltros} />
    </div>
  );
}
