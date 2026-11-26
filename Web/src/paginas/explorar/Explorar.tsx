// Explorar (Resolution do 19): coluna de filtros à esquerda (abaixo de 1024px, num painel) e
// grade de card A paginada pelo `total`. Os filtros moram na URL (busca.ts): o link abre a mesma busca em outra aba.
import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { getRouteApi } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

import type { TipoMidia } from '@dominio/estadoConsumo';
import { RECORTES, TIPOS_DO_RECORTE } from '@dominio/recorte';
import { emLancamento } from '@dominio/situacao';
import type { Midia } from '@dominio/tipos';

import { chaves } from '../../api/chaves';
import { exigir } from '../../api/cliente';
import { type Pagina, paginacao } from '../../api/paginacao';
import { useCatalogo } from '../../catalogo/CatalogoContext';
import { CardA, NotasCartao } from '../../componentes/Cards';
import { cartaoDaMidia } from '../../componentes/cartao';
import { Sheet } from '../../componentes/Camada';
import { Carregando, ErroTela, Vazio } from '../../componentes/Estados';
import { Icone } from '../../componentes/Icone';
import { Paginacao } from '../../componentes/Paginacao';
import { Selo } from '../../componentes/Selo';
import { useTelaLarga } from '../../layout/telaLarga';
import { useApi } from '../../sessao/SessaoContext';
import { LinkTemporada } from '../temporada/Temporada';
import { type BuscaExplorar, consultaDaBusca, FILTROS_DO_TIPO, filtrosAtivos, validarBuscaExplorar } from './busca';
import { CampoAtrasado } from './CampoAtrasado';
import { Filtros, type Mudar } from './Filtros';

const rota = getRouteApi('/autenticado/explorar');

/** Busca de 1 letra casaria quase tudo (como no app). */
const MINIMO_BUSCA = 2;

const semFiltrosDoTipo = (b: BuscaExplorar): BuscaExplorar => {
  const resto = { ...b };
  for (const f of FILTROS_DO_TIPO) delete resto[f];
  return resto;
};

/**
 * Mantém a URL e o catálogo da nav de acordo: um link com Tipo de outro catálogo troca o
 * catálogo ao abrir; trocar o catálogo pela nav descarta Tipo e filtros que não valem nele.
 */
function useCatalogoDaUrl(busca: BuscaExplorar, substituir: (b: BuscaExplorar) => void) {
  const { recorte, trocar, tipos } = useCatalogo();
  const inicio = useRef(true);

  useEffect(() => {
    const tipo = busca.tipo;
    if (tipo && !TIPOS_DO_RECORTE[recorte].includes(tipo)) {
      const doTipo = RECORTES.find((r) => TIPOS_DO_RECORTE[r].includes(tipo));
      if (doTipo) trocar(doTipo);
    }
    // Só ao abrir: depois, quem manda é a pílula do catálogo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (inicio.current) {
      inicio.current = false;
      return;
    }
    if (busca.tipo && TIPOS_DO_RECORTE[recorte].includes(busca.tipo)) return;
    substituir({ ...semFiltrosDoTipo(busca), tipo: undefined, pagina: undefined });
    // Reage só à troca de catálogo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorte]);

  // O Tipo da URL vale já no 1º render, antes de o catálogo trocar, para não buscar o outro.
  const tipo: TipoMidia = busca.tipo ?? tipos[0]!;
  const doTipo = RECORTES.find((r) => TIPOS_DO_RECORTE[r].includes(tipo)) ?? recorte;
  return { tipo, tipos: TIPOS_DO_RECORTE[doTipo] };
}

export function Explorar() {
  const busca = rota.useSearch();
  const navigate = rota.useNavigate();
  const api = useApi();
  const larga = useTelaLarga();
  // Abaixo de 1024px, os filtros ficam num painel.
  const [painel, setPainel] = useState(false);

  const navegar = (proxima: BuscaExplorar, replace = true) =>
    void navigate({ search: validarBuscaExplorar(proxima), replace });
  const { tipo, tipos } = useCatalogoDaUrl(busca, navegar);
  const tipoPadrao = tipos[0]!;

  // Todo filtro novo volta à 1ª página.
  const mudar: Mudar = (parcial) => navegar({ ...busca, ...parcial, pagina: undefined });
  const trocarTipo = (novo: TipoMidia) =>
    navegar({ ...semFiltrosDoTipo(busca), tipo: novo === tipoPadrao ? undefined : novo, pagina: undefined });
  const limpar = () => navegar({ busca: busca.busca });
  const irParaPagina = (pagina: number) => {
    navegar({ ...busca, pagina }, false);
    window.scrollTo({ top: 0 });
  };

  const consulta = consultaDaBusca(busca, tipo);
  const resultado = useQuery({
    queryKey: chaves.midias.explorar(consulta),
    queryFn: () => exigir(api.GET('/api/midias', { params: { query: consulta } })),
    placeholderData: keepPreviousData,
  });
  const generos = useQuery({
    queryKey: chaves.catalogo.generos(tipo),
    queryFn: () => exigir(api.GET('/api/generos', { params: { query: { tipo } } })),
    select: (r) => r.generos.map((g) => g.nome_genero),
    staleTime: Infinity,
  });
  // Só jogos (plataformas) e animes (estúdios) têm facetas.
  const facetas = useQuery({
    queryKey: chaves.catalogo.facetas(tipo),
    queryFn: () => exigir(api.GET('/api/midias/facetas', { params: { query: { tipo } } })),
    enabled: tipo === 'jogo' || tipo === 'anime',
    staleTime: Infinity,
  });
  const ativos = filtrosAtivos(busca, tipo, tipoPadrao);

  const filtros = (
    <Filtros
      busca={busca}
      tipo={tipo}
      tipos={tipos}
      generos={generos}
      facetas={facetas}
      mudar={mudar}
      trocarTipo={trocarTipo}
    />
  );
  const botaoLimpar = ativos ? (
    <button type="button" onClick={limpar} className="text-[14px] font-semibold text-marca-texto hover:underline">
      Limpar filtros ({ativos})
    </button>
  ) : null;

  return (
    <div className="grid gap-8 px-6 pb-24 pt-6 md:px-12 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
      <aside
        aria-label="Filtros"
        className="lg:sticky lg:top-[96px] lg:max-h-[calc(100vh-120px)] lg:self-start lg:overflow-y-auto lg:pr-2"
      >
        <h1 className="mb-5 text-[28px] font-bold text-texto-forte">Explorar</h1>
        {tipos.includes('anime') ? <LinkTemporada className="mb-5" /> : null}
        <div className="flex items-center gap-3">
          <label className="flex flex-1 items-center gap-2 rounded-md border border-borda bg-superficie-alta px-3 focus-within:border-marca-texto">
            <Icone nome="busca" tamanho={16} className="text-texto-suave" />
            <CampoAtrasado
              type="search"
              aria-label="Buscar por título"
              placeholder="Buscar por título"
              valor={busca.busca ?? ''}
              aceitar={(v) => v === '' || v.length >= MINIMO_BUSCA}
              mudar={(v) => mudar({ busca: v || undefined })}
              className="min-h-10 w-full bg-transparent text-[14px] text-texto-forte outline-none placeholder:text-texto-suave"
            />
          </label>
          {larga ? null : (
            <button
              type="button"
              onClick={() => setPainel(true)}
              aria-label={ativos ? `Filtros, ${ativos} ativo${ativos === 1 ? '' : 's'}` : 'Filtros'}
              className="flex h-11 shrink-0 items-center gap-2 rounded-md border border-borda px-3 text-[14px] font-semibold text-texto-forte hover:bg-superficie-alta"
            >
              <Icone nome="filtro" tamanho={16} /> Filtros
              {ativos ? (
                <span aria-hidden className="rounded-full bg-marca px-1.5 text-[12px] font-bold text-sobre-marca">
                  {ativos}
                </span>
              ) : null}
            </button>
          )}
        </div>
        {larga ? (
          <>
            <div className="mt-3">{filtros}</div>
            {botaoLimpar ? <div className="mt-4">{botaoLimpar}</div> : null}
          </>
        ) : (
          <Sheet titulo="Filtros" aberto={painel} fechar={() => setPainel(false)} rodape={botaoLimpar}>
            {filtros}
          </Sheet>
        )}
      </aside>
      <section aria-label="Mídias encontradas" className="min-w-0 lg:pt-14">
        <Resultados
          resultado={resultado}
          busca={busca.busca}
          limpar={ativos ? limpar : undefined}
          irParaPagina={irParaPagina}
        />
      </section>
    </div>
  );
}

type PropsResultados = {
  resultado: UseQueryResult<Pagina<Midia>>;
  busca?: string;
  limpar?: () => void;
  irParaPagina(pagina: number): void;
};

function Resultados({ resultado, busca, limpar, irParaPagina }: PropsResultados) {
  const { data, isPending, isError, error, refetch, isPlaceholderData } = resultado;
  if (isPending) return <Carregando rotulo="Buscando Mídias" />;
  if (isError && !data) return <ErroTela erro={error} tentarDeNovo={() => void refetch()} />;
  if (!data) return null;

  if (data.itens.length === 0) {
    const acao = limpar ? (
      <button type="button" onClick={limpar} className="font-semibold text-marca-texto hover:underline">
        Limpar filtros
      </button>
    ) : undefined;
    return <Vazio texto={busca ? `Nenhuma Mídia encontrada para "${busca}".` : 'Nenhuma Mídia com esses filtros.'} acao={acao} />;
  }

  const paginas = paginacao(data);
  return (
    <div className={`flex flex-col gap-8 motion-safe:transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
      <p className="text-[14px] text-texto-suave" aria-live="polite">
        {data.total === 1 ? '1 Mídia' : `${data.total} Mídias`}
        {busca ? ` para "${busca}"` : ''}
        {paginas.totalDePaginas > 1 && paginas.faixa ? ` · ${paginas.faixa.de}–${paginas.faixa.ate}` : ''}
      </p>
      <ul aria-label="Resultados" className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-4 gap-y-7">
        {data.itens.map((m) => {
          const lancamento = emLancamento(m);
          return (
            <li key={m.id_midia}>
              <CardA
                {...cartaoDaMidia(m)}
                notas={<NotasCartao midia={m} />}
                selos={lancamento ? <Selo texto={lancamento} tom="marca" /> : undefined}
              />
            </li>
          );
        })}
      </ul>
      <Paginacao paginacao={paginas} ir={irParaPagina} numeros />
    </div>
  );
}
