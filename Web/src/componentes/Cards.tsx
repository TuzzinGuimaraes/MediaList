// Card A (denso, carrosséis de catálogo) e card C (informativo, Continuar e destaques),
// pela Resolution do 29. Recebem dados já prontos para a tela: quem monta título, notas e
// selos a partir da Mídia e do Item é a tela, com o `dominio/`: `cartaoDaMidia` (título,
// pôster, Tipo, fio), `NotasCartao` (notas) e `SeloStatus` (Status do Item).
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { notasDaMidia } from '@dominio/midia';
import type { NotasDaMidia } from '@dominio/tipos';

import { FioProgresso } from './FioProgresso';
import { Monograma } from './Monograma';
import { Selo } from './Selo';

export type PropsCartao = {
  idMidia: string;
  titulo: string;
  posterUrl?: string | null;
  /** Nome do Tipo na tela ("Anime", "Mangá", "Jogo"). */
  tipo: string;
  /** Linha das notas (Nota dos Usuários, Nota da fonte). */
  notas?: ReactNode;
  /** Selos sobre o pôster: lançamento, Status. */
  selos?: ReactNode;
  /** Posição no Top 10 de hoje; selo no canto do pôster. */
  posicaoTop?: number | null;
  /** Fio de progresso: ausente sem Item na Lista; null com Item sem total conhecido. */
  progresso?: number | null;
  largura?: number;
  /** Nome acessível do card, quando o título sozinho não basta. */
  rotulo?: string;
};

function Poster({ url, titulo }: { url?: string | null; titulo: string }) {
  return url ? (
    <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
  ) : (
    <div className="flex h-full items-center justify-center" title={titulo}>
      <Monograma tamanho={32} rotulo={null} />
    </div>
  );
}

/** Linha das notas do card (Nota dos Usuários, Nota da fonte); nada sem notas. */
export function NotasCartao({ midia }: { midia: NotasDaMidia }) {
  const notas = notasDaMidia(midia);
  if (notas.length === 0) return null;
  return (
    <span className="flex gap-2 text-[12px] text-texto-suave">
      {notas.map((n) => (
        <span key={n.rotulo} aria-label={`${n.rotulo}: ${n.valor}`}>
          {n.curto} <span className="font-semibold text-texto">{n.valor}</span>
        </span>
      ))}
    </span>
  );
}

export function SeloTop({ posicao }: { posicao: number }) {
  return (
    <div
      role="img"
      aria-label={`Top 10, número ${posicao}`}
      className="flex flex-col items-center rounded-bl-md bg-marca px-1.5 pb-0.5 font-bold text-sobre-marca"
    >
      <span className="text-[11px] leading-[13px]">TOP</span>
      <span className="text-[16px] leading-[18px]">{posicao}</span>
    </div>
  );
}

/** Pôster, selos, fio, título, Tipo e notas do card A, dentro de um link interno, externo ou de nada. */
function ConteudoCardA({ titulo, posterUrl, tipo, notas, selos, posicaoTop, progresso }: Omit<PropsCartao, 'idMidia'>) {
  return (
    <>
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md bg-superficie-alta transition motion-safe:group-hover/card:-translate-y-1 group-hover/card:shadow-lg">
        <Poster url={posterUrl} titulo={titulo} />
        {posicaoTop ? (
          <div className="absolute right-0 top-0">
            <SeloTop posicao={posicaoTop} />
          </div>
        ) : null}
        {selos ? <div className="absolute inset-x-1 bottom-1.5 flex flex-col gap-1">{selos}</div> : null}
        {progresso !== undefined ? <FioProgresso proporcao={progresso} /> : null}
      </div>
      <span className="line-clamp-2 text-[13px] leading-tight text-texto group-hover/card:text-texto-forte">{titulo}</span>
      <Selo texto={tipo} />
      {notas}
    </>
  );
}

const CLASSE_CARD_A =
  'group/card flex shrink-0 flex-col gap-1.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-marca-texto';

/** Card A (denso): pôster 2:3 com selos e fio; título, Tipo e notas abaixo. */
export function CardA({ idMidia, largura, rotulo, ...conteudo }: PropsCartao) {
  return (
    <Link
      to="/midia/$id"
      params={{ id: idMidia }}
      aria-label={rotulo}
      className={CLASSE_CARD_A}
      style={largura ? { width: largura } : undefined}
    >
      <ConteudoCardA {...conteudo} />
    </Link>
  );
}

/**
 * Card A de uma obra fora do Catálogo: link externo para a fonte (`link`, já conferido como
 * `https://` por quem chama) numa aba nova; sem link, só o cartão.
 */
export function CardAFora({ link, largura, rotulo, ...conteudo }: Omit<PropsCartao, 'idMidia'> & { link: string | null }) {
  const estilo = largura ? { width: largura } : undefined;
  return link ? (
    <a href={link} target="_blank" rel="noopener noreferrer" aria-label={rotulo} className={CLASSE_CARD_A} style={estilo}>
      <ConteudoCardA {...conteudo} />
    </a>
  ) : (
    <article aria-label={rotulo} className={CLASSE_CARD_A} style={estilo}>
      <ConteudoCardA {...conteudo} />
    </article>
  );
}

type PropsCardC = PropsCartao & {
  bannerUrl?: string | null;
  /** Selo do Status do Item, abaixo das notas. */
  status?: ReactNode;
  /** Linha do Progresso ("Episódios: 3 de 12"). */
  detalhe?: ReactNode;
  altura?: number;
};

/** Card C (informativo): horizontal, banner esmaecido ao fundo, pôster pequeno, Status e fio. */
export function CardC({
  idMidia,
  titulo,
  posterUrl,
  bannerUrl,
  tipo,
  notas,
  status,
  detalhe,
  posicaoTop,
  progresso,
  largura,
  altura = 150,
}: PropsCardC) {
  const fundo = bannerUrl ?? posterUrl;
  return (
    <Link
      to="/midia/$id"
      params={{ id: idMidia }}
      className="group/card relative flex shrink-0 overflow-hidden rounded-lg bg-superficie outline-none transition hover:ring-1 hover:ring-borda focus-visible:ring-2 focus-visible:ring-marca-texto"
      style={{ width: largura, height: altura }}
    >
      {fundo ? (
        <img
          src={fundo}
          alt=""
          loading="lazy"
          className={`absolute inset-0 h-full w-full object-cover opacity-40 ${bannerUrl ? '' : 'blur-md'}`}
        />
      ) : null}
      <div className="absolute inset-0 bg-superficie/70" />
      <div className="relative m-2.5 aspect-[2/3] shrink-0 overflow-hidden rounded-md bg-superficie-alta">
        <Poster url={posterUrl} titulo={titulo} />
        {posicaoTop ? (
          <div className="absolute right-0 top-0">
            <SeloTop posicao={posicaoTop} />
          </div>
        ) : null}
      </div>
      <div className="relative flex min-w-0 flex-1 flex-col justify-center gap-1 py-2 pr-3">
        <Selo texto={tipo} />
        <span className="line-clamp-2 font-bold text-texto-forte">{titulo}</span>
        {notas}
        {status}
        {detalhe ? <span className="text-[12px] text-texto-suave">{detalhe}</span> : null}
      </div>
      {progresso !== undefined ? <FioProgresso proporcao={progresso} /> : null}
    </Link>
  );
}
