// PROTÓTIPO, eixo `explorar`: "Coluna" (filtros numa coluna fixa à esquerda) × "Sheet" (barra
// compacta que esconde ao rolar para baixo e volta ao subir, com os filtros num painel, como no app).
// A grade (card A) e a paginação pelo `total` são as mesmas.
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import { type FiltrosExplorar, type OrdemCatalogo, POR_PAGINA_EXPLORAR, useExplorar, useGeneros } from '../api';
import { useCatalogo } from '../catalogo';
import { CardA, Carregando, Gaveta, Pilulas, Vazio } from '../componentes';
import { NOMES_TIPO, nomeDaSituacao, type TipoMidia } from '../dominio';
import { Icone } from '../icones';
import { useVariante } from '../variantes';
import { Grupo } from './Lista';

const ORDENS: [OrdemCatalogo, string][] = [
  ['nota_media', 'Maiores notas'],
  ['popularidade', 'Populares'],
  ['data_lancamento', 'Mais recentes'],
  ['mais_adicionados', 'Mais adicionados'],
  ['titulo', 'Título (A–Z)'],
];

const SITUACOES: Record<TipoMidia, string[]> = {
  anime: ['em_exibicao', 'finalizado', 'aguardando', 'cancelado'],
  manga: ['em_publicacao', 'finalizado', 'hiato', 'cancelado'],
  jogo: ['lancado', 'em_desenvolvimento'],
};

type Estado = ReturnType<typeof useEstadoExplorar>;

function useEstadoExplorar() {
  const { tipos } = useCatalogo();
  const { busca: buscaUrl } = useSearch({ strict: false }) as { busca?: string };
  const primeiro = tipos[0]!;
  const [f, setF] = useState<FiltrosExplorar>({ tipo: primeiro, busca: buscaUrl ?? '', genero: null, status: null, ordem: 'nota_media', pagina: 1 });
  // Trocar de catálogo (ou buscar pelo topo) recomeça os filtros.
  useEffect(() => setF((a) => ({ ...a, tipo: primeiro, genero: null, status: null, pagina: 1 })), [primeiro]);
  useEffect(() => setF((a) => ({ ...a, busca: buscaUrl ?? '', pagina: 1 })), [buscaUrl]);
  const mudar = (p: Partial<FiltrosExplorar>) => setF((a) => ({ ...a, pagina: 1, ...p }));
  const resultado = useExplorar(f);
  const generos = useGeneros(f.tipo);
  const ativos = (f.genero ? 1 : 0) + (f.status ? 1 : 0) + (f.ordem !== 'nota_media' ? 1 : 0) + (f.tipo !== tipos[0] ? 1 : 0);
  return { f, mudar, tipos, resultado, generos: generos.data ?? [], ativos };
}

export function Explorar() {
  const variante = useVariante('explorar');
  const estado = useEstadoExplorar();
  return variante === 'sheet' ? <ExplorarSheet e={estado} /> : <ExplorarColuna e={estado} />;
}

function Filtros({ e, semBusca }: { e: Estado; semBusca?: boolean }) {
  const { f, mudar } = e;
  return (
    <div className="flex flex-col gap-6">
      {semBusca ? null : <CampoBusca e={e} />}
      {e.tipos.length > 1 ? (
        <Grupo titulo="Tipo">
          <Pilulas<TipoMidia> opcoes={e.tipos.map((t) => [t, NOMES_TIPO[t]])} valor={f.tipo} mudar={(tipo) => mudar({ tipo, genero: null, status: null })} />
        </Grupo>
      ) : null}
      <Grupo titulo="Ordem">
        <Pilulas<OrdemCatalogo> opcoes={ORDENS} valor={f.ordem} mudar={(ordem) => mudar({ ordem })} />
      </Grupo>
      <Grupo titulo="Situação">
        <Pilulas<string | null>
          opcoes={[[null, 'Todas'], ...SITUACOES[f.tipo].map((s): [string, string] => [s, nomeDaSituacao(s)])]}
          valor={f.status}
          mudar={(status) => mudar({ status })}
        />
      </Grupo>
      <Grupo titulo="Gênero">
        <Pilulas<string | null>
          opcoes={[[null, 'Todos'], ...e.generos.map((g): [string, string] => [g.nome_genero, g.nome_genero])]}
          valor={f.genero}
          mudar={(genero) => mudar({ genero })}
        />
      </Grupo>
    </div>
  );
}

function CampoBusca({ e, largo }: { e: Estado; largo?: boolean }) {
  const navigate = useNavigate();
  return (
    <label className={`flex items-center gap-2 rounded-md border border-borda bg-superficie-alta px-3 py-2 focus-within:border-marca-texto ${largo ? 'w-[420px]' : ''}`}>
      <Icone nome="busca" tamanho={16} className="text-texto-suave" />
      <input
        value={e.f.busca}
        onChange={(ev) => {
          e.mudar({ busca: ev.target.value });
          void navigate({ to: '.', search: ((p: object) => ({ ...p, busca: ev.target.value || undefined })) as never, replace: true });
        }}
        placeholder={`Buscar em ${NOMES_TIPO[e.f.tipo]}`}
        className="w-full bg-transparent text-[14px] text-texto-forte outline-none"
      />
    </label>
  );
}

function Resultados({ e }: { e: Estado }) {
  const { data, isPending, isPlaceholderData } = e.resultado;
  if (isPending) return <Carregando />;
  if (!data?.itens.length) return <Vazio texto="Nenhuma Mídia com esses filtros." />;
  return (
    <div className={`flex flex-col gap-8 transition-opacity ${isPlaceholderData ? 'opacity-50' : ''}`}>
      <p className="text-[14px] text-texto-suave">{data.total !== null ? `${data.total} Mídias` : `Página ${data.pagina}`}</p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-x-4 gap-y-7">
        {data.itens.map((m) => (
          <CardA key={m.id_midia} midia={m} />
        ))}
      </div>
      <Paginacao e={e} />
    </div>
  );
}

/** Paginação numerada pelo `total`; sem ele (backend antigo), só anterior/seguinte. */
function Paginacao({ e }: { e: Estado }) {
  const data = e.resultado.data!;
  const atual = e.f.pagina;
  const paginas = data.total !== null ? Math.max(1, Math.ceil(data.total / POR_PAGINA_EXPLORAR)) : null;
  const temProxima = paginas !== null ? atual < paginas : data.itens.length === POR_PAGINA_EXPLORAR;
  const ir = (p: number) => {
    e.mudar({ pagina: p });
    window.scrollTo({ top: 0 });
  };
  const numeros = paginas
    ? [...new Set([1, atual - 2, atual - 1, atual, atual + 1, atual + 2, paginas])].filter((p) => p >= 1 && p <= paginas).sort((a, b) => a - b)
    : [atual];
  const botao = 'flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-[14px]';
  return (
    <nav className="flex items-center justify-center gap-1.5">
      <button disabled={atual === 1} onClick={() => ir(atual - 1)} className={`${botao} text-texto-forte hover:bg-superficie-alta disabled:opacity-30`}>
        <Icone nome="esquerda" />
      </button>
      {numeros.map((p, i) => (
        <span key={p} className="flex items-center gap-1.5">
          {i > 0 && p - numeros[i - 1]! > 1 ? <span className="text-texto-suave">…</span> : null}
          <button onClick={() => ir(p)} className={`${botao} ${p === atual ? 'bg-marca font-bold text-sobre-marca' : 'text-texto hover:bg-superficie-alta'}`}>
            {p}
          </button>
        </span>
      ))}
      <button disabled={!temProxima} onClick={() => ir(atual + 1)} className={`${botao} text-texto-forte hover:bg-superficie-alta disabled:opacity-30`}>
        <Icone nome="direita" />
      </button>
    </nav>
  );
}

// ---------------------------------------------------------------- Coluna

function ExplorarColuna({ e }: { e: Estado }) {
  return (
    <div className="grid grid-cols-[280px_minmax(0,1fr)] gap-10 px-12 pb-24 pt-[calc(var(--topo)+28px)]">
      <aside className="sticky top-[calc(var(--topo)+28px)] h-[calc(100vh-var(--topo)-56px)] overflow-y-auto pr-2">
        <h1 className="mb-5 text-[28px] font-bold text-texto-forte">Explorar</h1>
        <Filtros e={e} />
        {e.ativos ? (
          <button onClick={() => e.mudar({ tipo: e.tipos[0]!, genero: null, status: null, ordem: 'nota_media' })} className="mt-6 text-[14px] text-marca-texto hover:underline">
            Limpar filtros ({e.ativos})
          </button>
        ) : null}
      </aside>
      <div className="pt-14">
        <Resultados e={e} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Sheet

/** Esconde ao rolar para baixo e volta ao subir; com "reduzir movimento", fica fixa. */
function useEscondeAoRolar() {
  const [visivel, setVisivel] = useState(true);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let ultimo = window.scrollY;
    const ver = () => {
      const y = window.scrollY;
      if (Math.abs(y - ultimo) > 6) setVisivel(y < ultimo || y < 80);
      ultimo = y;
    };
    window.addEventListener('scroll', ver, { passive: true });
    return () => window.removeEventListener('scroll', ver);
  }, []);
  return visivel;
}

function ExplorarSheet({ e }: { e: Estado }) {
  const [painel, setPainel] = useState(false);
  const visivel = useEscondeAoRolar();
  return (
    <div className="pb-24 pt-[var(--topo)]">
      <div
        className={`sticky top-[var(--topo)] z-30 flex items-center gap-4 border-b border-borda bg-fundo/95 px-12 py-4 backdrop-blur transition-transform duration-300 ${
          visivel ? '' : '-translate-y-[calc(100%+var(--topo))]'
        }`}
      >
        <h1 className="text-[24px] font-bold text-texto-forte">Explorar</h1>
        <CampoBusca e={e} largo />
        {e.tipos.length > 1 ? (
          <Pilulas<TipoMidia> opcoes={e.tipos.map((t) => [t, NOMES_TIPO[t]])} valor={e.f.tipo} mudar={(tipo) => e.mudar({ tipo, genero: null, status: null })} />
        ) : null}
        <button
          onClick={() => setPainel(true)}
          className="ml-auto flex items-center gap-2 rounded-md border border-borda px-3 py-2 text-[14px] text-texto-forte hover:bg-superficie-alta"
        >
          <Icone nome="filtro" tamanho={16} /> Filtros
          {e.ativos ? <span className="rounded-full bg-marca px-1.5 text-[12px] font-bold text-sobre-marca">{e.ativos}</span> : null}
        </button>
      </div>
      <div className="px-12 pt-6">
        <Resultados e={e} />
      </div>
      <Gaveta titulo="Filtros" aberta={painel} fechar={() => setPainel(false)}>
        <Filtros e={e} semBusca />
        <div className="mt-8 flex gap-2">
          <button onClick={() => e.mudar({ tipo: e.tipos[0]!, genero: null, status: null, ordem: 'nota_media' })} className="flex-1 rounded-md border border-borda py-2 text-texto-forte hover:bg-superficie-alta">
            Limpar
          </button>
          <button onClick={() => setPainel(false)} className="flex-[2] rounded-md bg-marca py-2 font-bold text-sobre-marca hover:bg-marca-forte">
            Ver resultados
          </button>
        </div>
      </Gaveta>
    </div>
  );
}
