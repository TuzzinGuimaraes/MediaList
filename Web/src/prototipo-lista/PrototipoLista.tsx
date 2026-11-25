// PROTÓTIPO (ticket 39, 2ª rodada): a Lista do web com o veredito de 2026-11-25 (navegação
// C com "Todos", filtros na coluna, tudo com virtualização) e os eixos que restam na barra:
// Formato (3/2/5) e posição do Tipo. Abre sem login nem backend em /prototipo/lista; dados
// fixos em dados.json, mudanças só em memória. Descartável: vira a tag prototipo/lista.
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { ROTULOS_POR_TIPO } from '@dominio/estadoConsumo';

import { Icone } from '../componentes/Icone';
import { COR_DO_ESTADO } from '../componentes/status';
import { Barra } from './Barra';
import type { Ordenacao } from './Colecao';
import { type Acoes, AcoesCtx } from './contexto';
import { type Base, CorpoStatus, CorpoTodos, Vazio } from './Corpo';
import {
  contar,
  ehJogo,
  estadosDe,
  type Filtros,
  filtrar,
  formatarNumero,
  type Item,
  ITENS,
  NOMES_ESTADO,
  opcoes as opcoesDe,
  type Ordem,
  ORDENS,
  organizar,
  type TipoFiltro,
  total,
} from './dados';
import { CartaoDestaque } from './Destaque';
import { AlternadorFormato, CampoBusca, FiltrosColuna, ListaStatus, OrdemColuna, type PropsFiltros, SegmentadoTipo, type StatusEscolhido, TipoColuna } from './Lateral';
import { useCartaoDestaque } from './useCartaoDestaque';
import { useVariantes } from './variantes';

const CHAVE_ORDEM = 'prototipo-lista.ordem';
const AGORA_ISO = '2026-11-24T20:00:00Z';

/** A Ordem escolhida fica salva (Q120), com a direção. */
function ordemSalva(): Pick<Filtros, 'ordem' | 'inversa'> {
  const [o, d] = (localStorage.getItem(CHAVE_ORDEM) ?? '').split(':');
  return { ordem: ORDENS.includes(o as Ordem) ? (o as Ordem) : 'padrao', inversa: d === 'inversa' };
}

/** Altura do topo fixo em --fixo, para os separadores de Status e a coluna grudarem abaixo dele. */
function useTopoFixo() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver(() => document.documentElement.style.setProperty('--fixo', `${el.getBoundingClientRect().height + 56}px`));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function NavFalsa() {
  const links = ['Início', 'Explorar', 'Minha Lista', 'Notícias'];
  return (
    <header className="sticky top-0 z-40 h-14 border-b border-borda/60 bg-nav/95 backdrop-blur">
      <div className="flex h-full items-center gap-8 px-6 lg:px-10">
        <span className="flex items-center gap-2">
          <span aria-hidden className="text-[26px] font-bold leading-none text-marca">M</span>
          <span className="text-[17px] font-bold text-texto-forte">MediaList</span>
        </span>
        <nav aria-label="Principal (falsa)" className="hidden gap-6 text-[14px] font-semibold sm:flex">
          {links.map((l) => (
            <a key={l} href="#" aria-current={l === 'Minha Lista' ? 'page' : undefined} className={`relative py-4 ${l === 'Minha Lista' ? 'text-texto-forte' : 'text-texto-suave hover:text-texto-forte'}`}>
              {l}
              {l === 'Minha Lista' ? <span aria-hidden className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-marca-forte" /> : null}
            </a>
          ))}
        </nav>
        <span className="ml-auto flex items-center gap-4 text-texto-suave">
          <Icone nome="sino" />
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-superficie-alta text-[13px] font-bold text-texto-forte">A</span>
        </span>
      </div>
    </header>
  );
}

export function PrototipoLista() {
  const [v, mudarV] = useVariantes();
  const topo = useTopoFixo();
  const cartao = useCartaoDestaque();

  // ---- Itens em memória (só o Status muda na Lista)
  const [mudancas, setMudancas] = useState<Record<string, Partial<Item>>>({});
  const itens = useMemo(() => ITENS.map((i) => (mudancas[i.id_lista] ? { ...i, ...mudancas[i.id_lista] } : i)), [mudancas]);
  const { destacar, soltar } = cartao;
  const acoes = useMemo<Acoes>(
    () => ({
      mudarStatus(i, e) {
        const t = total(i);
        const p: Partial<Item> = { status_consumo: ROTULOS_POR_TIPO[i.tipo][e]!, data_atualizacao: AGORA_ISO };
        // ADR-0009: concluir leva o Progresso ao total.
        if ((e === 'concluido' || e === 'platinado') && t !== null) p.progresso_atual = t;
        setMudancas((m) => ({ ...m, [i.id_lista]: { ...m[i.id_lista], ...p } }));
      },
      destacar,
      soltar,
    }),
    [destacar, soltar],
  );

  // ---- Filtros e Ordem
  const [f, setF] = useState<Filtros>(() => ({ busca: '', tipo: 'todos', genero: null, situacao: null, ...ordemSalva() }));
  const mudarF = useCallback((p: Partial<Filtros>) => {
    setF((x) => {
      const n = { ...x, ...p };
      if (p.ordem !== undefined || p.inversa !== undefined) localStorage.setItem(CHAVE_ORDEM, `${n.ordem}:${n.inversa ? 'inversa' : 'natural'}`);
      return n;
    });
  }, []);
  const ordenacao: Ordenacao = { ordem: f.ordem, inversa: f.inversa, mudar: mudarF };

  // ---- Status escolhido na coluna ("Todos" ao abrir)
  const estados = estadosDe(f.tipo);
  const [status, setStatus] = useState<StatusEscolhido>('todos');
  const ativo: StatusEscolhido = status === 'todos' || estados.includes(status) ? status : 'todos';

  const ops = opcoesDe(itens, f.tipo);
  const organizados = organizar(itens, f);
  const contagem = contar(organizados);
  const semTipo = filtrar(itens, { ...f, tipo: 'todos' });
  const contagemTipo: Record<TipoFiltro, number> = {
    todos: semTipo.length,
    anime: semTipo.filter((i) => i.tipo === 'anime').length,
    manga: semTipo.filter((i) => i.tipo === 'manga').length,
    jogo: semTipo.filter((i) => i.tipo === 'jogo').length,
  };
  const pf: PropsFiltros = { f, mudar: mudarF, opcoes: ops, contagemTipo };
  const base: Base = { formato: v.formato, tipo: f.tipo, ordenacao };
  const termo = f.busca.trim();

  const doTipo = itens.filter((i) => f.tipo === 'todos' || i.tipo === f.tipo);
  const horas = doTipo.filter(ehJogo).reduce((s, i) => s + (i.progresso_atual ?? 0), 0);
  const notas = doTipo.map((i) => i.nota_usuario).filter((n): n is number => n !== null);
  const media = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;

  const nAtivo = ativo === 'todos' ? organizados.length : contagem[ativo];
  const vazio =
    termo && organizados.length && ativo !== 'todos' ? (
      <Vazio
        texto={`Nada em ${NOMES_ESTADO[ativo]} com “${termo}”.`}
        acao={
          <button type="button" onClick={() => setStatus('todos')} className="text-[14px] font-semibold text-marca-texto hover:underline">
            Ver {organizados.length} em Todos
          </button>
        }
      />
    ) : (
      <Vazio
        texto={termo ? `Nada na Lista com “${termo}”.` : 'Nada na Lista com esses filtros.'}
        acao={
          <button type="button" onClick={() => mudarF({ busca: '', genero: null, situacao: null })} className="text-[14px] font-semibold text-marca-texto hover:underline">
            Limpar busca e filtros
          </button>
        }
      />
    );

  return (
    <AcoesCtx.Provider value={acoes}>
      <div className="min-h-screen pb-[260px]">
        <NavFalsa />
        <main className="px-6 lg:px-10">
          <div className="flex flex-wrap items-end gap-x-5 gap-y-1 pt-7 pb-4">
            <h1 className="text-[30px] font-bold leading-none text-texto-forte">Minha Lista</h1>
            <p className="text-[14px] text-texto-suave tabular-nums">
              {doTipo.length} Itens
              {f.tipo === 'todos' || f.tipo === 'jogo' ? (
                <>
                  {' · '}
                  <span className="font-semibold text-texto-forte">{formatarNumero(horas)} h</span> em jogos
                </>
              ) : null}
              {media !== null ? ` · nota média ${formatarNumero(Math.round(media * 10) / 10)}` : ''}
            </p>
          </div>

          <div ref={topo} className="sticky top-14 z-30 -mx-6 flex min-h-[60px] flex-wrap items-center gap-3 border-b border-borda/70 bg-fundo/95 px-6 py-2.5 backdrop-blur lg:-mx-10 lg:px-10">
            <p role="status" className="flex min-w-0 items-baseline gap-2.5">
              <span className="truncate text-[20px] font-bold" style={{ color: ativo === 'todos' ? undefined : COR_DO_ESTADO[ativo] }}>
                {ativo === 'todos' ? 'Todos' : NOMES_ESTADO[ativo]}
              </span>
              <span className="text-[14px] tabular-nums text-texto-suave">
                {nAtivo}
                {termo ? ` com “${termo}”` : ''}
              </span>
            </p>
            <div className="ml-auto flex items-center gap-3">
              {v.tipo === 'topo' ? <SegmentadoTipo {...pf} /> : null}
              <AlternadorFormato formato={v.formato} mudar={(formato) => mudarV({ formato })} />
            </div>
          </div>

          <div className="flex flex-col gap-6 pt-5 lg:flex-row lg:gap-8">
            <aside
              aria-label="Busca, Status e filtros"
              className="sem-barra shrink-0 lg:sticky lg:w-[232px] lg:self-start lg:overflow-y-auto lg:pb-4"
              style={{ top: 'calc(var(--fixo) + 16px)', maxHeight: 'calc(100vh - var(--fixo) - 24px)' }}
            >
              <div className="flex flex-col gap-6">
                <CampoBusca f={f} mudar={mudarF} />
                {v.tipo === 'lateral' ? <TipoColuna {...pf} /> : null}
                <ListaStatus estados={estados} contagem={contagem} total={organizados.length} ativa={ativo} escolher={setStatus} />
                <hr className="border-borda" />
                <FiltrosColuna {...pf} />
                <OrdemColuna f={f} mudar={mudarF} />
              </div>
            </aside>
            <div className="min-w-0 flex-1">
              {ativo === 'todos' ? <CorpoTodos estados={estados} itens={organizados} base={base} vazio={vazio} /> : <CorpoStatus e={ativo} itens={organizados} base={base} vazio={vazio} />}
            </div>
          </div>
        </main>
        {cartao.aberto && v.formato !== '3' ? <CartaoDestaque key={cartao.aberto.item.id_lista} a={cartao.aberto} segurar={cartao.segurar} soltar={() => cartao.soltar()} /> : null}
        <Barra v={v} mudar={mudarV} />
      </div>
    </AcoesCtx.Provider>
  );
}
