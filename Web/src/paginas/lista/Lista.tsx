// Minha Lista (Resolutions do 19 e do 34): abas por Status com contagem, título colorido da
// aba, subseções Anime/Mangá, cards compactos em grade auto-fill e "Sugestões para você".
// Filtros e Ordem valem para todos os Status (as contagens refletem o filtro); a busca
// procura em todos os Status e troca as abas por uma lista única de resultados.
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';

import { contarPorEstado, type EstadoConsumo, NOMES_ESTADO, NOMES_TIPO } from '@dominio/estadoConsumo';
import {
  buscarNaLista,
  FILTROS_PADRAO,
  type FiltrosLista,
  filtrosAtivos,
  filtrosEfetivos,
  filtrosRestringem,
  opcoesDosFiltros,
  organizarLista,
  porTipo,
} from '@dominio/filtrosLista';
import { foraDe } from '@dominio/inicio';
import { estadosDaLista, itensDoEstado } from '@dominio/itemLista';

import { mensagemDeErro } from '../../api/erros';
import { useCatalogo } from '../../catalogo/CatalogoContext';
import { CardA, NotasCartao } from '../../componentes/Cards';
import { cartaoDaMidia } from '../../componentes/cartao';
import { Carregando, ErroTela, Vazio } from '../../componentes/Estados';
import { Fileira } from '../../componentes/Fileira';
import { Icone } from '../../componentes/Icone';
import { COR_DO_ESTADO } from '../../componentes/status';
import { ALTURA_NAV } from '../../layout/Casca';
import { type ItemLista, useEmAltaDaLista, useLista, useMudarProgresso } from './api';
import { type AcoesDoItem, CardItem } from './CardItem';
import { useEditorItem } from './EditorItemContext';
import { FiltrosDaLista } from './FiltrosDaLista';

const textos = {
  titulo: 'Minha Lista',
  itens: (n: number) => (n === 1 ? '1 Item' : `${n} Itens`),
  abas: 'Status da Lista',
  buscar: 'Buscar na Lista',
  campoBusca: 'Buscar em todos os Status',
  fecharBusca: 'Fechar busca',
  filtros: 'Filtros',
  filtrosAtivos: (n: number) => `Filtros, ${n} ativo${n === 1 ? '' : 's'}`,
  resultados: (n: number, termo: string) =>
    `${n === 1 ? '1 resultado' : `${n} resultados`} para “${termo}” em todos os Status`,
  semResultado: 'Nada na Lista com esse título.',
  vazio: (estado: string) => `Nenhum Item em ${estado}.`,
  vazioFiltrado: (estado: string) => `Nenhum Item em ${estado} com esses filtros.`,
  sugestoes: 'Sugestões para você',
};

/** Lupa que vira campo; Esc ou o X fecham e limpam a busca. */
function CampoBusca({ valor, mudar }: { valor: string | null; mudar(v: string | null): void }) {
  const campo = useRef<HTMLInputElement>(null);
  const aberta = valor !== null;
  useEffect(() => {
    if (aberta) campo.current?.focus();
  }, [aberta]);
  if (!aberta) {
    return (
      <button
        type="button"
        onClick={() => mudar('')}
        aria-label={textos.buscar}
        className="flex h-11 w-11 items-center justify-center rounded-md text-texto-forte hover:bg-superficie-alta"
      >
        <Icone nome="busca" />
      </button>
    );
  }
  return (
    <div className="flex h-11 items-center gap-2 rounded-md border border-marca-texto bg-superficie-alta px-3">
      <Icone nome="busca" tamanho={16} className="text-texto-suave" />
      <input
        ref={campo}
        type="search"
        aria-label={textos.buscar}
        value={valor}
        onChange={(e) => mudar(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && mudar(null)}
        placeholder={textos.campoBusca}
        className="w-64 bg-transparent text-[14px] text-texto-forte outline-none placeholder:text-texto-suave"
      />
      <button type="button" onClick={() => mudar(null)} aria-label={textos.fecharBusca} className="text-texto-suave hover:text-texto-forte">
        <Icone nome="fechar" tamanho={16} />
      </button>
    </div>
  );
}

type PropsAbas = {
  estados: EstadoConsumo[];
  contagem: Record<EstadoConsumo, number>;
  ativa: EstadoConsumo;
  escolher(estado: EstadoConsumo): void;
};

/** Abas por Status (padrão ARIA de abas: setas, Home e End movem entre elas). */
function AbasStatus({ estados, contagem, ativa, escolher }: PropsAbas) {
  const lista = useRef<HTMLDivElement>(null);
  const mover = (e: KeyboardEvent) => {
    const i = estados.indexOf(ativa);
    const alvo =
      e.key === 'ArrowRight' ? (i + 1) % estados.length
      : e.key === 'ArrowLeft' ? (i - 1 + estados.length) % estados.length
      : e.key === 'Home' ? 0
      : e.key === 'End' ? estados.length - 1
      : null;
    const destino = alvo === null ? undefined : estados[alvo];
    if (alvo === null || !destino) return;
    e.preventDefault();
    escolher(destino);
    lista.current?.querySelectorAll<HTMLElement>('[role="tab"]')[alvo]?.focus();
  };
  return (
    <div ref={lista} role="tablist" aria-label={textos.abas} onKeyDown={mover} className="mt-4 flex gap-6">
      {estados.map((e) => {
        const selecionada = e === ativa;
        return (
          <button
            key={e}
            type="button"
            role="tab"
            id={`aba-${e}`}
            aria-selected={selecionada}
            aria-controls="painel-status"
            tabIndex={selecionada ? 0 : -1}
            onClick={() => escolher(e)}
            className={`relative pb-3 text-[15px] font-semibold outline-none focus-visible:text-texto-forte focus-visible:underline ${
              selecionada ? 'text-texto-forte' : 'text-texto-suave hover:text-texto'
            }`}
          >
            {NOMES_ESTADO[e]} <span className="font-normal opacity-70">{contagem[e]}</span>
            {selecionada ? (
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] rounded-t" style={{ background: COR_DO_ESTADO[e] }} />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Grade compacta: cards de ~300px, tantas colunas quanto couberem. */
function Grade({ itens, acoes, comStatus }: { itens: ItemLista[]; acoes: AcoesDoItem; comStatus?: boolean }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-2">
      {itens.map((i) => (
        <CardItem key={i.id_lista} item={i} acoes={acoes} comStatus={comStatus} />
      ))}
    </div>
  );
}

/** "Sugestões para você": Em alta do catálogo fora da Lista, no card A. */
function Sugestoes({ lista }: { lista: ItemLista[] }) {
  const { recorte } = useCatalogo();
  const emAlta = useEmAltaDaLista(recorte);
  const sugestoes = foraDe(emAlta.data, lista);
  return (
    <div className="mt-12">
      <Fileira titulo={textos.sugestoes} vazia={sugestoes.length === 0}>
        {sugestoes.map((m) => (
          <CardA key={m.id_midia} {...cartaoDaMidia(m)} notas={<NotasCartao midia={m} />} largura={160} />
        ))}
      </Fileira>
    </div>
  );
}

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
              <Grade itens={resultados} acoes={acoes} comStatus />
            </section>
          ) : (
            <Vazio texto={textos.semResultado} />
          )
        ) : (
          <div role="tabpanel" id="painel-status" aria-labelledby={`aba-${ativa}`} className="flex flex-col gap-6">
            <h2 className="text-[22px] font-bold" style={{ color: COR_DO_ESTADO[ativa] }}>
              {`${NOMES_ESTADO[ativa]} · ${contagem[ativa]}`}
            </h2>
            {daAba.length ? (
              porTipo(daAba, tipos).map((s) => (
                <section key={s.tipo ?? 'todos'} aria-label={s.tipo ? NOMES_TIPO[s.tipo] : undefined} className="flex flex-col gap-2.5">
                  {s.tipo ? (
                    <h3 className="text-[15px] font-semibold text-texto-suave">{`${NOMES_TIPO[s.tipo]} · ${s.itens.length}`}</h3>
                  ) : null}
                  <Grade itens={s.itens} acoes={acoes} />
                </section>
              ))
            ) : (
              <Vazio
                texto={filtrosRestringem(efetivos) ? textos.vazioFiltrado(NOMES_ESTADO[ativa]) : textos.vazio(NOMES_ESTADO[ativa])}
              />
            )}
          </div>
        )}
      </div>

      <Sugestoes lista={lista.data} />

      <FiltrosDaLista aberto={painel} fechar={() => setPainel(false)} filtros={efetivos} opcoes={opcoes} mudar={setFiltros} />
    </div>
  );
}
