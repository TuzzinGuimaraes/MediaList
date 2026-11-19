// PROTÓTIPO, Lista (Q73, fixa na 2ª rodada): abas por Status e cards compactos de ~300px (pôster
// pequeno, título, Status, nota, stepper e fio) em quantas colunas couberem. Filtros, Ordem e busca
// da Resolution do 34: as contagens das abas refletem o filtro; com busca, uma lista única.
import { type ReactNode, useEffect, useRef, useState } from 'react';

import { useEmAlta, useLista } from '../api';
import { useCatalogo } from '../catalogo';
import { CardA, Carregando, EditorItem, Fileira, Gaveta, LinhaItem, Pilulas, Vazio } from '../componentes';
import {
  ABREVIADO,
  buscarNaLista,
  COR_DO_ESTADO,
  type EstadoConsumo,
  FILTROS_PADRAO,
  filtrosAtivos,
  type FiltrosLista,
  foraDe,
  type ItemLista,
  itensDoEstado,
  NOMES_ESTADO,
  NOMES_ORDEM,
  NOMES_TIPO,
  opcoesDosFiltros,
  type OrdemLista,
  ORDEM_ABAS,
  organizarLista,
  ROTULOS,
  type TipoMidia,
} from '../dominio';
import { Icone } from '../icones';

export function Lista() {
  const { recorte, tipos } = useCatalogo();
  const lista = useLista();
  const emAlta = useEmAlta(recorte);
  const [aba, setAba] = useState<EstadoConsumo>('em_progresso');
  const [filtros, setFiltros] = useState<FiltrosLista>(FILTROS_PADRAO);
  const [painel, setPainel] = useState(false);
  const [busca, setBusca] = useState<string | null>(null);
  const [editando, setEditando] = useState<ItemLista | null>(null);

  if (!lista.data) return <div className="pt-[var(--topo)]"><Carregando /></div>;

  const doCatalogo = lista.data.filter((i) => tipos.includes(i.tipo));
  const organizados = organizarLista(doCatalogo, filtros);
  const estados = ORDEM_ABAS.filter((e) => tipos.some((t) => ROTULOS[t][e]));
  const contagem = Object.fromEntries(estados.map((e) => [e, itensDoEstado(organizados, e).length])) as Record<EstadoConsumo, number>;
  const buscando = busca !== null && busca.trim() !== '';
  const resultados = buscando ? buscarNaLista(organizados, busca) : [];
  const daAba = itensDoEstado(organizados, aba);
  const sugestoes = foraDe(emAlta.data, doCatalogo).slice(0, 20);
  const ativos = filtrosAtivos(filtros);

  return (
    <div className="pb-24 pt-[var(--topo)]">
      {/* Cabeçalho fixo: título, busca (lupa que vira campo) e Filtros; abas por Status abaixo. */}
      <div className="sticky top-[var(--topo)] z-30 border-b border-borda bg-fundo/95 px-12 pt-6 backdrop-blur">
        <div className="flex items-center gap-4">
          <h1 className="text-[28px] font-bold text-texto-forte">Minha Lista</h1>
          <span className="text-texto-suave">{doCatalogo.length} Itens</span>
          <div className="ml-auto flex items-center gap-3">
            <CampoBusca valor={busca} mudar={setBusca} />
            <button
              onClick={() => setPainel(true)}
              className="flex items-center gap-2 rounded-md border border-borda px-3 py-1.5 text-[14px] text-texto-forte hover:bg-superficie-alta"
            >
              <Icone nome="filtro" tamanho={16} /> Filtros
              {ativos ? <span className="rounded-full bg-marca px-1.5 text-[12px] font-bold text-sobre-marca">{ativos}</span> : null}
            </button>
          </div>
        </div>
        {buscando ? (
          <p className="py-3 text-[14px] text-texto-suave">
            {resultados.length} resultado(s) para “{busca}” em todos os Status
          </p>
        ) : (
          <div className="mt-4 flex gap-6">
            {estados.map((e) => (
              <button
                key={e}
                onClick={() => setAba(e)}
                className={`relative pb-3 text-[14px] font-semibold ${e === aba ? 'text-texto-forte' : 'text-texto-suave hover:text-texto'}`}
                title={NOMES_ESTADO[e]}
              >
                {ABREVIADO[e]} <span className="font-normal opacity-70">{contagem[e]}</span>
                {e === aba ? <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-t" style={{ background: COR_DO_ESTADO[e] }} /> : null}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-6 px-12 pt-6">
        {buscando ? (
          resultados.length ? (
            <Cards itens={resultados} editar={setEditando} />
          ) : (
            <Vazio texto="Nada na Lista com esse título." />
          )
        ) : (
          <>
            <h2 className="text-[22px] font-bold" style={{ color: COR_DO_ESTADO[aba] }}>
              {NOMES_ESTADO[aba]} · {daAba.length}
            </h2>
            {daAba.length ? (
              porTipo(daAba, tipos).map((s) => (
                <section key={s.tipo ?? 'todos'} className="flex flex-col gap-2.5">
                  {s.tipo ? (
                    <h3 className="text-[15px] font-semibold text-texto-suave">
                      {NOMES_TIPO[s.tipo]} · {s.itens.length}
                    </h3>
                  ) : null}
                  <Cards itens={s.itens} editar={setEditando} />
                </section>
              ))
            ) : (
              <Vazio texto={ativos ? 'Nenhum Item com esses filtros.' : 'Nenhum Item neste Status.'} />
            )}
          </>
        )}
      </div>

      <div className="mt-12">
        <Fileira titulo="Sugestões para você" vazia={!sugestoes.length}>
          {sugestoes.map((m) => (
            <CardA key={m.id_midia} midia={m} largura={160} />
          ))}
        </Fileira>
      </div>

      <Gaveta titulo="Filtros da Lista" aberta={painel} fechar={() => setPainel(false)}>
        <PainelFiltros itens={doCatalogo} filtros={filtros} mudar={setFiltros} />
      </Gaveta>
      {editando ? <EditorItem midia={editando} item={editando} fechar={() => setEditando(null)} /> : null}
    </div>
  );
}

function porTipo(itens: ItemLista[], tipos: TipoMidia[]): { tipo: TipoMidia | null; itens: ItemLista[] }[] {
  if (tipos.length < 2) return [{ tipo: null, itens }];
  return tipos.map((tipo) => ({ tipo, itens: itens.filter((i) => i.tipo === tipo) })).filter((s) => s.itens.length);
}

function CampoBusca({ valor, mudar }: { valor: string | null; mudar(v: string | null): void }) {
  const ref = useRef<HTMLInputElement>(null);
  const aberta = valor !== null;
  useEffect(() => {
    if (aberta) ref.current?.focus();
  }, [aberta]);
  if (valor === null)
    return (
      <button onClick={() => mudar('')} aria-label="Buscar na Lista" className="rounded-md p-2 text-texto-forte hover:bg-superficie-alta">
        <Icone nome="busca" />
      </button>
    );
  return (
    <label className="flex items-center gap-2 rounded-md border border-marca-texto bg-superficie-alta px-2.5 py-1.5">
      <Icone nome="busca" tamanho={16} className="text-texto-suave" />
      <input
        ref={ref}
        value={valor}
        onChange={(e) => mudar(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && mudar(null)}
        placeholder="Buscar em todos os Status"
        className="w-64 bg-transparent text-[14px] text-texto-forte outline-none"
      />
      <button onClick={() => mudar(null)} aria-label="Fechar busca" className="text-texto-suave hover:text-texto-forte">
        <Icone nome="fechar" tamanho={16} />
      </button>
    </label>
  );
}

function PainelFiltros({ itens, filtros, mudar }: { itens: ItemLista[]; filtros: FiltrosLista; mudar(f: FiltrosLista): void }) {
  const opcoes = opcoesDosFiltros(itens);
  return (
    <div className="flex flex-col gap-6">
      <Grupo titulo="Ordem">
        <Pilulas<OrdemLista>
          opcoes={(Object.keys(NOMES_ORDEM) as OrdemLista[]).map((o) => [o, NOMES_ORDEM[o]])}
          valor={filtros.ordem}
          mudar={(ordem) => mudar({ ...filtros, ordem })}
        />
      </Grupo>
      <Grupo titulo="Situação">
        <Pilulas<string | null>
          opcoes={[[null, 'Todas'], ...opcoes.situacoes.map((s): [string, string] => [s.valor, s.titulo])]}
          valor={filtros.situacao}
          mudar={(situacao) => mudar({ ...filtros, situacao })}
        />
      </Grupo>
      <Grupo titulo="Gênero">
        <Pilulas<string | null>
          opcoes={[[null, 'Todos'], ...opcoes.generos.map((g): [string, string] => [g, g])]}
          valor={filtros.genero}
          mudar={(genero) => mudar({ ...filtros, genero })}
        />
      </Grupo>
      <button onClick={() => mudar(FILTROS_PADRAO)} className="self-start text-[14px] text-marca-texto hover:underline">
        Limpar filtros
      </button>
    </div>
  );
}

export function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-texto-suave">{titulo}</h3>
      {children}
    </div>
  );
}

/** Grade compacta: cards de ~300px, tantas colunas quanto couberem (3 ou 4 num 1080p). */
function Cards({ itens, editar }: { itens: ItemLista[]; editar(i: ItemLista): void }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-2">
      {itens.map((i) => (
        <LinhaItem key={i.id_lista} item={i} editar={() => editar(i)} />
      ))}
    </div>
  );
}
