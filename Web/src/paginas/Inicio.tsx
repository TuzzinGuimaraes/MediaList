// PROTÓTIPO, Início híbrido (Q72, fixo na 2ª rodada): destaque em ~45vh com troca a cada 6 s e
// pontos; logo abaixo, a fileira Continuar (card C), visível sem rolar num 1080p; depois Em alta,
// Top 10 (com numeral) e as demais da Resolution do 29, todas fileiras horizontais. Sem coluna.
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
  const dados = useDadosInicio();
  if (!dados) return <div className="pt-[var(--topo)]"><Carregando /></div>;
  if (!dados.emAlta.length) return <div className="pt-[var(--topo)]"><Vazio texto="Nenhuma Mídia neste catálogo ainda." /></div>;
  return <InicioHibrido dados={dados} />;
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

function Fileiras({ dados }: { dados: Dados }) {
  const linha = (titulo: string, midias: (Midia | MidiaPopular)[]) => (
    <Fileira key={titulo} titulo={titulo} vazia={!midias.length}>
      {midias.map((m) => (
        <CardA key={m.id_midia} midia={m} largura={160} />
      ))}
    </Fileira>
  );
  return (
    <div className="flex flex-col gap-9">
      <Fileira titulo="Continuar" vazia={!dados.continuar.length}>
        {dados.continuar.map((i) => (
          <CardC key={i.id_lista} midia={i} largura={340} altura={136} />
        ))}
      </Fileira>
      {linha('Em alta', dados.emAlta)}
      <Fileira titulo="Top 10 de hoje" vazia={!dados.top10.length}>
        {dados.top10.map((m, i) => (
          <CardTop key={m.id_midia} midia={m} posicao={i + 1} />
        ))}
      </Fileira>
      {linha('Maiores notas', dados.maioresNotas)}
      {linha('Lançamentos recentes', dados.lancamentos)}
      {dados.porGenero.map((g) => linha(`Porque você curte ${g.genero}`, g.midias))}
      {linha('Mais adicionados', dados.maisAdicionados)}
      {linha(dados.maisConcluidos.titulo, dados.maisConcluidos.midias)}
    </div>
  );
}

function InicioHibrido({ dados }: { dados: Dados }) {
  const d = useDestaques(dados.destaques.length);
  const midia = dados.destaques[d.pagina]!;
  return (
    <div className="pb-24">
      {/* 45vh, com piso para a nav no topo (72px) não comer o texto em telas baixas. */}
      <section className="relative h-[45vh] min-h-[380px] overflow-hidden" onMouseEnter={d.pausar} onMouseLeave={d.retomar}>
        <FundoDestaque midia={midia} />
        <div className="absolute bottom-12 left-12 max-w-[620px]">
          <TextoDestaque midia={midia} compacto />
        </div>
        <div className="absolute bottom-12 right-12">
          <Pontos total={dados.destaques.length} pagina={d.pagina} ir={d.setPagina} />
        </div>
      </section>
      <div className="relative z-10 -mt-4">
        <Fileiras dados={dados} />
      </div>
    </div>
  );
}
