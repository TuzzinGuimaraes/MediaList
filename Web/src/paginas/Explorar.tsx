// PROTÓTIPO, Explorar (Q74, fixo na 2ª rodada): coluna de filtros à esquerda, em seções
// recolhíveis (Tipo, Gênero com 8 + "+N", Situação, Ano, Ordem e as do Tipo: Plataforma e Modo nos
// jogos, Estúdio nos animes, Demografia nos mangás). Grade de card A e paginação pelo `total`.
import { useNavigate, useSearch } from '@tanstack/react-router';
import { type ReactNode, useEffect, useState } from 'react';

import { type FiltrosExplorar, type FiltrosExtras, type OrdemCatalogo, POR_PAGINA_EXPLORAR, SEM_EXTRAS, useExplorar, useFacetas, useGeneros } from '../api';
import { useCatalogo } from '../catalogo';
import { CardA, Carregando, Pilulas, Vazio } from '../componentes';
import { type Midia, NOMES_TIPO, nomeDaSituacao, type TipoMidia } from '../dominio';
import { Icone } from '../icones';

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

const MODOS: [string, string][] = [
  ['single', 'Um jogador'],
  ['multi', 'Multijogador'],
  ['ambos', 'Os dois'],
];

const DEMOGRAFIAS: [string, string][] = [
  ['shounen', 'Shounen'],
  ['shoujo', 'Shoujo'],
  ['seinen', 'Seinen'],
  ['josei', 'Josei'],
  ['kodomomuke', 'Kodomomuke'],
];

const VISIVEIS = 8;

/** PROTÓTIPO: a API ainda não aceita `ano_min`/`ano_max` (Q74); o Ano filtra só a página carregada. */
type Anos = { de: string; ate: string };
const SEM_ANOS: Anos = { de: '', ate: '' };

function anoNaFaixa(m: Midia, a: Anos): boolean {
  if (!a.de && !a.ate) return true;
  const ano = m.data_lancamento ? Number(m.data_lancamento.slice(0, 4)) : null;
  if (ano === null) return false;
  return (!a.de || ano >= Number(a.de)) && (!a.ate || ano <= Number(a.ate));
}

type Estado = ReturnType<typeof useEstadoExplorar>;

function useEstadoExplorar() {
  const { tipos } = useCatalogo();
  const { busca: buscaUrl } = useSearch({ strict: false }) as { busca?: string };
  const primeiro = tipos[0]!;
  const inicial: FiltrosExplorar = { tipo: primeiro, busca: buscaUrl ?? '', genero: null, status: null, ordem: 'nota_media', pagina: 1, ...SEM_EXTRAS };
  const [f, setF] = useState<FiltrosExplorar>(inicial);
  const [anos, setAnos] = useState<Anos>(SEM_ANOS);
  // Trocar de catálogo (ou buscar pelo topo) recomeça os filtros.
  useEffect(() => setF((a) => ({ ...a, tipo: primeiro, genero: null, status: null, pagina: 1, ...SEM_EXTRAS })), [primeiro]);
  useEffect(() => setF((a) => ({ ...a, busca: buscaUrl ?? '', pagina: 1 })), [buscaUrl]);
  const mudar = (p: Partial<FiltrosExplorar>) => setF((a) => ({ ...a, pagina: 1, ...p }));
  const trocarTipo = (tipo: TipoMidia) => mudar({ tipo, genero: null, status: null, ...SEM_EXTRAS });
  const limpar = () => {
    mudar({ tipo: primeiro, genero: null, status: null, ordem: 'nota_media', ...SEM_EXTRAS });
    setAnos(SEM_ANOS);
  };
  const resultado = useExplorar(f);
  const generos = useGeneros(f.tipo);
  const facetas = useFacetas(f.tipo);
  const extras = (Object.keys(SEM_EXTRAS) as (keyof FiltrosExtras)[]).filter((k) => f[k]).length;
  const ativos =
    (f.genero ? 1 : 0) + (f.status ? 1 : 0) + (f.ordem !== 'nota_media' ? 1 : 0) + (f.tipo !== primeiro ? 1 : 0) + (anos.de || anos.ate ? 1 : 0) + extras;
  return { f, mudar, trocarTipo, limpar, anos, setAnos, tipos, resultado, generos: generos.data ?? [], facetas: facetas.data, ativos };
}

export function Explorar() {
  const e = useEstadoExplorar();
  return (
    <div className="grid grid-cols-[280px_minmax(0,1fr)] gap-10 px-12 pb-24 pt-[calc(var(--topo)+28px)]">
      <aside className="sem-barra sticky top-[calc(var(--topo)+28px)] h-[calc(100vh-var(--topo)-56px)] overflow-y-auto pr-2">
        <h1 className="mb-5 text-[28px] font-bold text-texto-forte">Explorar</h1>
        <CampoBusca e={e} />
        <div className="mt-4 flex flex-col">
          <Filtros e={e} />
        </div>
        {e.ativos ? (
          <button onClick={e.limpar} className="mt-5 text-[14px] text-marca-texto hover:underline">
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

/** Seção recolhível da coluna; o resumo mostra o valor escolhido quando ela está fechada. */
function Secao({ titulo, resumo, abertaDeInicio = true, children }: { titulo: string; resumo?: string | null; abertaDeInicio?: boolean; children: ReactNode }) {
  const [aberta, setAberta] = useState(abertaDeInicio);
  return (
    <section className="border-b border-borda py-3">
      <button onClick={() => setAberta((a) => !a)} aria-expanded={aberta} className="flex w-full items-center gap-2 text-left">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-texto-suave">{titulo}</h3>
        {!aberta && resumo ? <span className="truncate text-[13px] text-marca-texto">{resumo}</span> : null}
        <Icone nome="baixo" tamanho={16} className={`ml-auto text-texto-suave transition-transform duration-150 ${aberta ? 'rotate-180' : ''}`} />
      </button>
      {aberta ? <div className="pt-3">{children}</div> : null}
    </section>
  );
}

/** Pílulas com só as 8 primeiras visíveis e um chip "+N" que expande (e "Menos" que recolhe). */
function PilulasLimitadas({ opcoes, valor, mudar, todos }: { opcoes: string[]; valor: string | null; mudar(v: string | null): void; todos: string }) {
  const [tudo, setTudo] = useState(false);
  // O escolhido fica sempre visível, mesmo fora dos 8.
  const base = tudo ? opcoes : opcoes.slice(0, VISIVEIS);
  const visiveis = valor && !base.includes(valor) ? [...base, valor] : base;
  const resto = opcoes.length - VISIVEIS;
  const chip = 'rounded-full border border-dashed border-borda px-3 py-1 text-[13px] font-semibold text-marca-texto hover:border-marca-texto';
  return (
    <div className="flex flex-wrap gap-1.5 [&>div]:contents">
      <Pilulas<string | null> opcoes={[[null, todos], ...visiveis.map((g): [string, string] => [g, g])]} valor={valor} mudar={mudar} />
      {resto > 0 ? (
        <button onClick={() => setTudo((t) => !t)} className={chip} aria-expanded={tudo}>
          {tudo ? 'Menos' : `+${resto}`}
        </button>
      ) : null}
    </div>
  );
}

function Filtros({ e }: { e: Estado }) {
  const { f, mudar } = e;
  const nomeDe = (opcoes: [string, string][], v: string | null) => opcoes.find(([k]) => k === v)?.[1] ?? null;
  const campoAno = 'w-full rounded-md border border-borda bg-superficie-alta px-3 py-1.5 text-[14px] text-texto-forte outline-none focus:border-marca-texto';
  return (
    <>
      {e.tipos.length > 1 ? (
        <Secao titulo="Tipo" resumo={NOMES_TIPO[f.tipo]}>
          <Pilulas<TipoMidia> opcoes={e.tipos.map((t) => [t, NOMES_TIPO[t]])} valor={f.tipo} mudar={e.trocarTipo} />
        </Secao>
      ) : null}
      <Secao titulo="Gênero" resumo={f.genero}>
        <PilulasLimitadas key={f.tipo} opcoes={e.generos.map((g) => g.nome_genero)} valor={f.genero} mudar={(genero) => mudar({ genero })} todos="Todos" />
      </Secao>
      <Secao titulo="Situação" resumo={f.status ? nomeDaSituacao(f.status) : null}>
        <Pilulas<string | null>
          opcoes={[[null, 'Todas'], ...SITUACOES[f.tipo].map((s): [string, string] => [s, nomeDaSituacao(s)])]}
          valor={f.status}
          mudar={(status) => mudar({ status })}
        />
      </Secao>
      <Secao titulo="Ano" resumo={e.anos.de || e.anos.ate ? `${e.anos.de || '…'} a ${e.anos.ate || '…'}` : null}>
        <div className="flex items-center gap-2">
          <input aria-label="Ano de" type="number" inputMode="numeric" placeholder="De" min={1900} max={2100} value={e.anos.de} onChange={(ev) => e.setAnos({ ...e.anos, de: ev.target.value })} className={campoAno} />
          <span className="text-texto-suave">a</span>
          <input aria-label="Ano até" type="number" inputMode="numeric" placeholder="Até" min={1900} max={2100} value={e.anos.ate} onChange={(ev) => e.setAnos({ ...e.anos, ate: ev.target.value })} className={campoAno} />
        </div>
      </Secao>
      <Secao titulo="Ordem" resumo={nomeDe(ORDENS, f.ordem)}>
        <Pilulas<OrdemCatalogo> opcoes={ORDENS} valor={f.ordem} mudar={(ordem) => mudar({ ordem })} />
      </Secao>
      {f.tipo === 'jogo' ? (
        <>
          <Secao titulo="Plataforma" resumo={f.plataforma}>
            <PilulasLimitadas key="plataforma" opcoes={e.facetas?.plataformas ?? []} valor={f.plataforma} mudar={(plataforma) => mudar({ plataforma })} todos="Todas" />
          </Secao>
          <Secao titulo="Modo de jogo" resumo={nomeDe(MODOS, f.modo_jogo)}>
            <Pilulas<string | null> opcoes={[[null, 'Todos'], ...MODOS]} valor={f.modo_jogo} mudar={(modo_jogo) => mudar({ modo_jogo })} />
          </Secao>
        </>
      ) : null}
      {f.tipo === 'anime' ? (
        <Secao titulo="Estúdio" resumo={f.estudio}>
          <PilulasLimitadas key="estudio" opcoes={e.facetas?.estudios ?? []} valor={f.estudio} mudar={(estudio) => mudar({ estudio })} todos="Todos" />
        </Secao>
      ) : null}
      {f.tipo === 'manga' ? (
        <Secao titulo="Demografia" resumo={nomeDe(DEMOGRAFIAS, f.demografia)}>
          <Pilulas<string | null> opcoes={[[null, 'Todas'], ...DEMOGRAFIAS]} valor={f.demografia} mudar={(demografia) => mudar({ demografia })} />
        </Secao>
      ) : null}
    </>
  );
}

function CampoBusca({ e }: { e: Estado }) {
  const navigate = useNavigate();
  return (
    <label className={`flex items-center gap-2 rounded-md border border-borda bg-superficie-alta px-3 py-2 focus-within:border-marca-texto`}>
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
  const comAno = !!(e.anos.de || e.anos.ate);
  const itens = data.itens.filter((m) => anoNaFaixa(m, e.anos));
  return (
    <div className={`flex flex-col gap-8 transition-opacity ${isPlaceholderData ? 'opacity-50' : ''}`}>
      <p className="text-[14px] text-texto-suave">
        {data.total !== null ? `${data.total} Mídias` : `Página ${data.pagina}`}
        {comAno ? ` · ${itens.length} desta página no Ano escolhido (protótipo: o Ano ainda filtra só a página)` : ''}
      </p>
      {itens.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-x-4 gap-y-7">
          {itens.map((m) => (
            <CardA key={m.id_midia} midia={m} />
          ))}
        </div>
      ) : (
        <Vazio texto="Nada desta página no Ano escolhido." />
      )}
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
