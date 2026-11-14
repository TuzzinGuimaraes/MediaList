// PROTÓTIPO, eixo `inicio`: A (destaque largo ~70vh + fileiras de card A) × B (destaque na
// coluna principal + coluna lateral com Continuar em card C e Top 10). Os dados são os mesmos.
import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import { useCarrosseisPorGenero, useCarrossel, useEmAlta, useLista, usePopulares } from '../api';
import { useCatalogo } from '../catalogo';
import {
  BotaoDaLista,
  CardA,
  CardC,
  CardTop,
  Carregando,
  Fileira,
  Notas,
  Selo,
  SeloStatus,
  TituloSecao,
  usePosicaoTop10,
  Vazio,
} from '../componentes';
import {
  estadoDe,
  foraDe,
  generosQueVoceCurte,
  jaLancadas,
  MAIS_CONCLUIDOS,
  type Midia,
  type MidiaPopular,
  NOMES_TIPO,
  tituloAlternativo,
  tituloDe,
} from '../dominio';
import { Icone } from '../icones';
import { useVariante } from '../variantes';

const INTERVALO_MS = 6000;

/** Tudo que o Início mostra, na ordem da Resolution do 29; carrosséis vazios somem. */
function useDadosInicio() {
  const { recorte, tipos } = useCatalogo();
  const emAlta = useEmAlta(recorte);
  const populares = usePopulares(recorte);
  const lista = useLista();
  const maioresNotas = useCarrossel(recorte, 'nota_media');
  const lancamentos = useCarrossel(recorte, 'data_lancamento');
  const maisAdicionados = useCarrossel(recorte, 'mais_adicionados');
  const maisConcluidos = useCarrossel(recorte, 'mais_concluidos');
  const itens = lista.data?.filter((i) => tipos.includes(i.tipo));
  const generos = itens && populares.data ? generosQueVoceCurte(itens, populares.data) : [];
  const porGenero = useCarrosseisPorGenero(recorte, generos);

  if (!emAlta.data || !populares.data) return null;
  const top10 = populares.data.slice(0, 10);
  return {
    destaques: emAlta.data.slice(0, 5),
    continuar: (itens ?? []).filter((i) => estadoDe(i.status_consumo, i.tipo) === 'em_progresso'),
    emAlta: emAlta.data,
    top10,
    maioresNotas: foraDe(maioresNotas.data, emAlta.data),
    lancamentos: jaLancadas(lancamentos.data ?? []),
    porGenero: generos.map((genero, i) => ({ genero, midias: foraDe(porGenero[i]?.data, itens) })),
    maisAdicionados: foraDe(maisAdicionados.data, top10),
    maisConcluidos: { titulo: tipos.length === 1 ? MAIS_CONCLUIDOS[tipos[0]!] : 'Mais concluídos', midias: maisConcluidos.data ?? [] },
  };
}

type Dados = NonNullable<ReturnType<typeof useDadosInicio>>;

export function Inicio() {
  const variante = useVariante('inicio');
  const dados = useDadosInicio();
  if (!dados) return <div className="pt-[var(--topo)]"><Carregando /></div>;
  if (!dados.emAlta.length) return <div className="pt-[var(--topo)]"><Vazio texto="Nenhuma Mídia neste catálogo ainda." /></div>;
  return variante === 'b' ? <InicioB dados={dados} /> : <InicioA dados={dados} />;
}

/** Página atual dos destaques, trocando a cada 6 s enquanto não está pausada (hover). */
function useDestaques(total: number) {
  const [pagina, setPagina] = useState(0);
  const [pausa, setPausa] = useState(false);
  useEffect(() => {
    if (pausa || total < 2) return;
    const id = setTimeout(() => setPagina((p) => (p + 1) % total), INTERVALO_MS);
    return () => clearTimeout(id);
  }, [pagina, pausa, total]);
  return { pagina: Math.min(pagina, total - 1), setPagina, pausar: () => setPausa(true), retomar: () => setPausa(false) };
}

function Pontos({ total, pagina, ir }: { total: number; pagina: number; ir(p: number): void }) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          onClick={() => ir(i)}
          aria-label={`Destaque ${i + 1}`}
          className={`h-1.5 rounded-full transition-all ${i === pagina ? 'w-7 bg-marca-forte' : 'w-3 bg-white/40 hover:bg-white/70'}`}
        />
      ))}
    </div>
  );
}

/** Conteúdo textual de um destaque: selos, título, nota, Status e as ações. */
function TextoDestaque({ midia, compacto }: { midia: Midia; compacto?: boolean }) {
  const { data: lista } = useLista();
  const item = lista?.find((i) => i.id_midia === midia.id_midia);
  const estado = item ? estadoDe(item.status_consumo, item.tipo) : null;
  const top = usePosicaoTop10(midia.id_midia);
  const alt = tituloAlternativo(midia);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Selo texto={NOMES_TIPO[midia.tipo]} sobreImagem />
        {midia.generos_lista.slice(0, 3).map((g) => (
          <Selo key={g} texto={g} sobreImagem />
        ))}
        {top ? <Selo texto={`Top ${top}`} tom="marca" /> : null}
      </div>
      <h1 className={`font-bold leading-[1.05] text-white drop-shadow ${compacto ? 'line-clamp-2 text-[34px]' : 'line-clamp-2 text-[52px]'}`}>
        {tituloDe(midia)}
      </h1>
      {alt && !compacto ? <p className="-mt-1 text-[15px] text-white/60">{alt}</p> : null}
      <div className="flex items-center gap-3 [&_.text-texto-suave]:text-white/70">
        <Notas midia={midia} grande />
        {estado ? <SeloStatus estado={estado} sobreImagem /> : null}
      </div>
      {midia.sinopse ? (
        <p className={`max-w-[600px] text-white/80 ${compacto ? 'line-clamp-2 text-[14px]' : 'line-clamp-3 text-[15px]'}`}>{midia.sinopse}</p>
      ) : null}
      <div className="mt-1 flex gap-3">
        <BotaoDaLista midia={midia} grande={!compacto} />
        <Link
          to="/midia/$id"
          params={{ id: midia.id_midia }}
          className="inline-flex items-center gap-2 rounded-md bg-white/15 px-4 py-2 font-semibold text-white backdrop-blur hover:bg-white/25"
        >
          <Icone nome="info" /> Detalhes
        </Link>
      </div>
    </div>
  );
}

function FundoDestaque({ midia }: { midia: Midia }) {
  const img = midia.banner_url ?? midia.poster_url;
  return (
    <>
      {img ? (
        <img key={midia.id_midia} src={img} alt="" className={`absolute inset-0 h-full w-full animate-[fade_600ms] object-cover ${midia.banner_url ? '' : 'scale-110 blur-xl'}`} />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-fundo via-transparent to-black/30" />
    </>
  );
}

/** As fileiras de catálogo comuns às duas variantes (sem Continuar e Top 10 no B, que vão na coluna). */
function Fileiras({ dados, comContinuarETop, recuo, largura = 168 }: { dados: Dados; comContinuarETop: boolean; recuo?: string; largura?: number }) {
  const linha = (titulo: string, midias: (Midia | MidiaPopular)[]) => (
    <Fileira key={titulo} titulo={titulo} vazia={!midias.length} recuo={recuo}>
      {midias.map((m) => (
        <CardA key={m.id_midia} midia={m} largura={largura} />
      ))}
    </Fileira>
  );
  return (
    <div className="flex flex-col gap-9">
      {comContinuarETop ? (
        <Fileira titulo="Continuar" vazia={!dados.continuar.length} recuo={recuo}>
          {dados.continuar.map((i) => (
            <CardC key={i.id_lista} midia={i} largura={360} />
          ))}
        </Fileira>
      ) : null}
      {linha('Em alta', dados.emAlta)}
      {comContinuarETop ? (
        <Fileira titulo="Top 10 de hoje" vazia={!dados.top10.length} recuo={recuo}>
          {dados.top10.map((m, i) => (
            <CardTop key={m.id_midia} midia={m} posicao={i + 1} />
          ))}
        </Fileira>
      ) : null}
      {linha('Maiores notas', dados.maioresNotas)}
      {linha('Lançamentos recentes', dados.lancamentos)}
      {dados.porGenero.map((g) => linha(`Porque você curte ${g.genero}`, g.midias))}
      {linha('Mais adicionados', dados.maisAdicionados)}
      {linha(dados.maisConcluidos.titulo, dados.maisConcluidos.midias)}
    </div>
  );
}

// ---------------------------------------------------------------- A

function InicioA({ dados }: { dados: Dados }) {
  const d = useDestaques(dados.destaques.length);
  const midia = dados.destaques[d.pagina]!;
  return (
    <div className="pb-24">
      <section className="relative h-[70vh] min-h-[520px] overflow-hidden" onMouseEnter={d.pausar} onMouseLeave={d.retomar}>
        <FundoDestaque midia={midia} />
        <div className="absolute bottom-[18%] left-12 max-w-[640px]">
          <TextoDestaque midia={midia} />
        </div>
        <div className="absolute bottom-[18%] right-12">
          <Pontos total={dados.destaques.length} pagina={d.pagina} ir={d.setPagina} />
        </div>
      </section>
      <div className="relative z-10 -mt-[10vh]">
        <Fileiras dados={dados} comContinuarETop />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- B

function InicioB({ dados }: { dados: Dados }) {
  const d = useDestaques(dados.destaques.length);
  const midia = dados.destaques[d.pagina]!;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_380px] gap-8 px-8 pb-24 pt-[calc(var(--topo)+24px)]">
      <div className="flex min-w-0 flex-col gap-9">
        <section className="relative h-[440px] overflow-hidden rounded-xl" onMouseEnter={d.pausar} onMouseLeave={d.retomar}>
          <FundoDestaque midia={midia} />
          <div className="absolute bottom-8 left-8 right-48">
            <TextoDestaque midia={midia} compacto />
          </div>
          {/* Miniaturas dos destaques, no lugar dos pontos. */}
          <div className="absolute bottom-6 right-6 flex gap-2">
            {dados.destaques.map((m, i) => (
              <button
                key={m.id_midia}
                onClick={() => d.setPagina(i)}
                className={`relative h-[72px] w-12 overflow-hidden rounded transition ${i === d.pagina ? 'ring-2 ring-marca-forte' : 'opacity-60 hover:opacity-100'}`}
                aria-label={tituloDe(m)}
              >
                {m.poster_url ? <img src={m.poster_url} alt="" className="h-full w-full object-cover" /> : null}
              </button>
            ))}
          </div>
        </section>
        <Fileiras dados={dados} comContinuarETop={false} recuo="px-0" largura={150} />
      </div>
      <aside className="sticky top-[calc(var(--topo)+24px)] flex h-[calc(100vh-var(--topo)-48px)] flex-col gap-6 overflow-y-auto pr-1">
        {dados.continuar.length ? (
          <section>
            <TituloSecao direita={<Link to="/lista" className="text-[13px] text-marca-texto hover:underline">Ver Lista</Link>}>Continuar</TituloSecao>
            <div className="flex flex-col gap-2.5">
              {dados.continuar.slice(0, 4).map((i) => (
                <CardC key={i.id_lista} midia={i} altura={120} />
              ))}
            </div>
          </section>
        ) : null}
        <section>
          <TituloSecao>Top 10 de hoje</TituloSecao>
          <ol className="flex flex-col">
            {dados.top10.map((m, i) => (
              <li key={m.id_midia}>
                <Link to="/midia/$id" params={{ id: m.id_midia }} className="flex items-center gap-3 rounded-md px-1 py-1.5 hover:bg-superficie">
                  <span className={`w-7 text-center text-[22px] font-bold ${i < 3 ? 'text-marca-texto' : 'text-texto-suave'}`}>{i + 1}</span>
                  <span className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-superficie-alta">
                    {m.poster_url ? <img src={m.poster_url} alt="" className="h-full w-full object-cover" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 text-[14px] font-semibold text-texto-forte">{tituloDe(m)}</span>
                    <span className="text-[12px] text-texto-suave">
                      {NOMES_TIPO[m.tipo]} · {m.total_usuarios} na Lista
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      </aside>
    </div>
  );
}
