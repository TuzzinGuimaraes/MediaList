// Minha Lista (ticket 39, veredito e Resolution): coluna lateral com busca, Tipo, Status com
// "Todos", Gênero, Situação e Ordem; cabeçalho fixo com o Status ativo, a contagem e o
// alternador de formato; o corpo virtualizado no formato da URL ou no salvo (grade de capas
// por padrão), com o cartão de destaque nas linhas. Dados de GET /lista; busca, filtros e
// Ordem no cliente (`@dominio/filtrosLista`). Abre em "Todos", na Ordem salva (a
// padrão da Q120: nota no anime/mangá, horas no jogo).
import { getRouteApi, Link } from '@tanstack/react-router';
import { type CSSProperties, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { contarPorEstado, mediaNotasPessoais, NOMES_ESTADO } from '@dominio/estadoConsumo';
import {
  buscarNaLista,
  contagemPorTipo,
  doTipo,
  filtrosEfetivos,
  generosPorFrequencia,
  opcoesDosFiltros,
  organizarLista,
  type TipoDaLista,
  tiposDoFiltro,
} from '@dominio/filtrosLista';
import { estadosDaLista } from '@dominio/itemLista';

import { FOCO } from '../../componentes/estilos';
import { mensagemDeErro } from '../../api/erros';
import { Carregando, ErroTela, Vazio } from '../../componentes/Estados';
import { COR_DO_ESTADO } from '../../componentes/status';
import { ALTURA_NAV } from '../../layout/Casca';
import { AlternadorFormato } from './AlternadorFormato';
import { useLista, useMudarStatus } from './api';
import type { Ordenacao } from './Colecao';
import { CampoBusca, FiltrosColuna, ListaStatus, OrdemColuna, SeletorTipo, type StatusEscolhido } from './ColunaLateral';
import { ALTURA_SEPARADOR, type BaseDoCorpo, CorpoStatus, CorpoTodos } from './CorpoLista';
import { ProvedorDestaque } from './Destaque';
import { type FormatoLista, formatoValido, usePreferenciasDaLista } from './preferencias';
import { formatarNumero, textos } from './textos';

const rota = getRouteApi('/autenticado/lista');

/** Altura do cabeçalho fixo antes de medir (e no jsdom, sem ResizeObserver). */
const ALTURA_CABECALHO = 60;

/** Onde termina o cabeçalho fixo: os separadores de Status e a coluna grudam abaixo dele. */
function useAlturaDoCabecalho(pronto: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [altura, setAltura] = useState(ALTURA_CABECALHO);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(() => setAltura(Math.round(el.getBoundingClientRect().height)));
    observador.observe(el);
    return () => observador.disconnect();
  }, [pronto]);
  return [ref, altura] as const;
}

/**
 * O formato em vigor: o da URL (`?formato=`) vence e passa a ser o salvo; sem ele, o salvo.
 * Trocar pelo alternador grava e põe na URL (a grade, o padrão, sai dela).
 */
function useFormato(salvo: FormatoLista, salvar: (f: FormatoLista) => void) {
  // A raiz não valida a busca e repassa os parâmetros crus: valor desconhecido é ignorado aqui.
  const bruto = rota.useSearch().formato;
  const daUrl = formatoValido(bruto) ? bruto : undefined;
  const navegar = rota.useNavigate();
  // Grava quando a URL traz um formato novo; o alternador grava e muda a URL (que chega
  // depois), e esse valor já está gravado.
  const gravado = useRef<FormatoLista | undefined>(undefined);
  useEffect(() => {
    if (daUrl && daUrl !== gravado.current) {
      gravado.current = daUrl;
      salvar(daUrl);
    }
  }, [daUrl, salvar]);
  const mudar = (f: FormatoLista) => {
    gravado.current = f;
    salvar(f);
    void navegar({ search: f === 'grade' ? {} : { formato: f }, replace: true });
  };
  return [daUrl ?? salvo, mudar] as const;
}

/** Folga entre o que é fixo e o Item focado. */
const FOLGA = 8;

/**
 * O `scroll-padding-top` da página: a nav, o cabeçalho fixo e, no "Todos", o separador
 * grudento de Status. Assim o foco (Tab, ou o que a Lista põe depois de mudar o Status) e a
 * rolagem até um Item nunca o deixam escondido embaixo deles. Sai com a Lista.
 */
function FolgaDeRolagem({ altura }: { altura: number }) {
  useLayoutEffect(() => {
    const raiz = document.documentElement;
    raiz.style.scrollPaddingTop = `${altura}px`;
    return () => {
      raiz.style.scrollPaddingTop = '';
    };
  }, [altura]);
  return null;
}

type Restricao = { genero: string | null; situacao: string | null };
const SEM_RESTRICAO: Restricao = { genero: null, situacao: null };

export function Lista() {
  const lista = useLista();
  const status = useMudarStatus();
  const [preferencias, mudarPreferencias] = usePreferenciasDaLista();
  const [busca, setBusca] = useState('');
  const [tipo, setTipo] = useState<TipoDaLista>('todos');
  const [restricao, setRestricao] = useState<Restricao>(SEM_RESTRICAO);
  const [escolhido, setEscolhido] = useState<StatusEscolhido>('todos');
  const [refCabecalho, alturaCabecalho] = useAlturaDoCabecalho(lista.data !== undefined);
  const salvarFormato = useCallback((formato: FormatoLista) => mudarPreferencias({ formato }), [mudarPreferencias]);
  const [formato, mudarFormato] = useFormato(preferencias.formato, salvarFormato);

  if (lista.isError) return <ErroTela erro={lista.error} tentarDeNovo={() => void lista.refetch()} />;
  if (!lista.data) return <Carregando rotulo="Carregando a Lista" />;

  const todos = lista.data;
  const { ordem, inversa } = preferencias;
  const doTipoEscolhido = doTipo(todos, tipo);
  // Gênero ou Situação que não existem no Tipo escolhido voltam a "todos".
  const filtros = filtrosEfetivos({ ...restricao, ordem, inversa }, opcoesDosFiltros(doTipoEscolhido));
  const termo = busca.trim();
  // Busca e filtros, sem o Tipo: as contagens do seletor de Tipo.
  const semTipo = buscarNaLista(organizarLista(todos, filtros), termo);
  const organizados = doTipo(semTipo, tipo);
  const contagem = contarPorEstado(organizados);
  const estados = estadosDaLista(tiposDoFiltro(tipo));
  // Trocar de Tipo pode sumir com o Status escolhido (Platinado só existe em jogo).
  const ativo: StatusEscolhido = escolhido === 'todos' || estados.includes(escolhido) ? escolhido : 'todos';
  const noAtivo = ativo === 'todos' ? organizados.length : contagem[ativo];

  const horas = doTipoEscolhido.filter((i) => i.tipo === 'jogo').reduce((soma, i) => soma + (i.progresso_atual ?? 0), 0);
  const media = mediaNotasPessoais(doTipoEscolhido);

  const ordenacao: Ordenacao = { ordem, inversa, mudar: mudarPreferencias };
  const base: BaseDoCorpo = {
    formato,
    tipo,
    ordenacao,
    mudarStatus: (item, rotulo) => status.mutate({ item, rotulo }),
  };

  const acao = (texto: string, aoClicar: () => void) => (
    <button type="button" onClick={aoClicar} className={`rounded text-[14px] font-semibold text-marca-texto hover:underline ${FOCO}`}>
      {texto}
    </button>
  );
  const vazio = !todos.length ? (
    <Vazio
      texto={textos.vazia}
      acao={
        <Link to="/explorar" className={`rounded text-[14px] font-semibold text-marca-texto hover:underline ${FOCO}`}>
          {textos.explorar}
        </Link>
      }
    />
  ) : termo && organizados.length && ativo !== 'todos' ? (
    <Vazio texto={textos.nadaNoStatus(NOMES_ESTADO[ativo], termo)} acao={acao(textos.verEmTodos(organizados.length), () => setEscolhido('todos'))} />
  ) : (
    <Vazio
      texto={termo ? textos.nadaComBusca(termo) : textos.nadaComFiltros}
      acao={acao(textos.limparBuscaEFiltros, () => {
        setBusca('');
        setRestricao(SEM_RESTRICAO);
      })}
    />
  );

  const topo = ALTURA_NAV + alturaCabecalho;
  return (
    <div className="px-6 pb-24 lg:px-10" style={{ '--topo-da-lista': `${topo}px` } as CSSProperties}>
      <FolgaDeRolagem altura={topo + (ativo === 'todos' ? ALTURA_SEPARADOR : 0) + FOLGA} />
      <div className="flex flex-wrap items-end gap-x-5 gap-y-1 pb-4 pt-7">
        <h1 className="text-[30px] font-bold leading-none text-texto-forte">{textos.titulo}</h1>
        <p className="text-[14px] tabular-nums text-texto-suave">
          {textos.itens(doTipoEscolhido.length)}
          {horas > 0 ? (
            <>
              {' · '}
              <span className="font-semibold text-texto-forte">{formatarNumero(horas)} h</span> {textos.horasEmJogos}
            </>
          ) : null}
          {media !== null ? ` · ${textos.notaMedia(Math.round(media * 10) / 10)}` : ''}
        </p>
      </div>

      <div
        ref={refCabecalho}
        style={{ top: ALTURA_NAV }}
        className="sticky z-30 -mx-6 flex min-h-[60px] flex-wrap items-center gap-3 border-b border-borda/70 bg-fundo/95 px-6 py-2.5 backdrop-blur lg:-mx-10 lg:px-10"
      >
        <p aria-live="polite" className="flex min-w-0 items-baseline gap-2.5">
          <span className="truncate text-[20px] font-bold text-texto-forte" style={{ color: ativo === 'todos' ? undefined : COR_DO_ESTADO[ativo] }}>
            {ativo === 'todos' ? textos.todos : NOMES_ESTADO[ativo]}
          </span>{' '}
          <span className="text-[14px] tabular-nums text-texto-suave">
            {noAtivo}
            {termo ? textos.com(termo) : ''}
          </span>
        </p>
        <div className="ml-auto">
          <AlternadorFormato formato={formato} mudar={mudarFormato} />
        </div>
      </div>

      {status.isError ? (
        <p role="alert" className="pt-4 text-[14px] text-erro">
          {mensagemDeErro(status.error)}
        </p>
      ) : null}

      <div className="flex flex-col gap-6 pt-5 lg:flex-row lg:gap-8">
        <aside
          aria-label={textos.coluna}
          // Fixa e com rolagem própria só ao lado do corpo (lg); empilhada, cresce com o conteúdo.
          className="sem-barra shrink-0 lg:sticky lg:top-[calc(var(--topo-da-lista)+16px)] lg:max-h-[calc(100vh-var(--topo-da-lista)-24px)] lg:w-[232px] lg:self-start lg:overflow-y-auto lg:pb-4"
        >
          <div className="flex flex-col gap-6">
            <CampoBusca valor={busca} mudar={setBusca} />
            <SeletorTipo
              tipo={tipo}
              contagem={contagemPorTipo(semTipo)}
              mudar={(t) => {
                setTipo(t);
                setRestricao(SEM_RESTRICAO);
              }}
            />
            <ListaStatus estados={estados} contagem={contagem} total={organizados.length} ativo={ativo} escolher={setEscolhido} />
            <hr className="border-borda" />
            <FiltrosColuna
              generos={generosPorFrequencia(doTipoEscolhido)}
              situacoes={opcoesDosFiltros(doTipoEscolhido).situacoes}
              genero={filtros.genero}
              situacao={filtros.situacao}
              mudar={(m) => setRestricao((r) => ({ ...r, ...m }))}
            />
            <OrdemColuna ordem={ordem} inversa={inversa} tipo={tipo} mudar={mudarPreferencias} />
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <ProvedorDestaque>
            {ativo === 'todos' ? (
              <CorpoTodos estados={estados} itens={organizados} base={base} vazio={vazio} />
            ) : (
              <CorpoStatus estado={ativo} itens={organizados} base={base} vazio={vazio} />
            )}
          </ProvedorDestaque>
        </div>
      </div>
    </div>
  );
}
