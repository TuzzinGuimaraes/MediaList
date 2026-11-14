// PROTÓTIPO: peças compartilhadas pelas variantes, na identidade aprovada no app (ticket 29):
// selos, fio de progresso carmesim, monograma, card A (denso) e card C (informativo), fileiras,
// stepper e o editor do Item. Layouts ficam nas páginas, não aqui.
import { Link } from '@tanstack/react-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';

import { useGravarItem, useItemDe, useMudarProgresso, usePopulares, useRemoverItem } from './api';
import { useCatalogo } from './catalogo';
import {
  type CartaoMidia,
  COR_DO_ESTADO,
  emLancamento,
  type EstadoConsumo,
  estadoDe,
  estadosDoTipo,
  type ItemLista,
  NOMES_ESTADO,
  NOMES_TIPO,
  notasDe,
  passo,
  proporcaoDoFio,
  recontagem,
  ROTULOS,
  temProgresso,
  tituloDe,
  totalDoItem,
  UNIDADE,
} from './dominio';
import { Icone } from './icones';

// ---------------------------------------------------------------- marca

export function Monograma({ tamanho = 28 }: { tamanho?: number }) {
  return (
    <span className="font-bold leading-none text-marca" style={{ fontSize: tamanho, letterSpacing: -tamanho * 0.04 }} aria-label="MediaList">
      M
    </span>
  );
}

export function Carregando() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="animate-pulse">
        <Monograma tamanho={56} />
      </div>
    </div>
  );
}

export function Vazio({ texto }: { texto: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-texto-suave">
      <Monograma tamanho={44} />
      <p>{texto}</p>
    </div>
  );
}

// ---------------------------------------------------------------- selos

const FUNDO_SOBRE_IMAGEM = 'rgba(0,0,0,0.72)';

export function Selo({ texto, tom = 'neutro', sobreImagem }: { texto: string; tom?: 'neutro' | 'marca' | EstadoConsumo; sobreImagem?: boolean }) {
  const base = 'inline-flex w-fit items-center gap-1 rounded-sm px-1.5 text-[12px] leading-[18px] font-semibold';
  if (tom === 'marca') return <span className={`${base} bg-marca font-bold text-sobre-marca`}>{texto}</span>;
  if (tom === 'neutro')
    return sobreImagem ? (
      <span className={`${base} text-[#F2F2F2]`} style={{ background: FUNDO_SOBRE_IMAGEM }}>
        {texto}
      </span>
    ) : (
      <span className={`${base} border border-borda text-texto-suave`}>{texto}</span>
    );
  const cor = COR_DO_ESTADO[tom];
  return (
    <span
      className={`${base} border`}
      style={{
        background: sobreImagem ? FUNDO_SOBRE_IMAGEM : `color-mix(in srgb, ${cor} 14%, transparent)`,
        borderColor: `color-mix(in srgb, ${cor} 55%, transparent)`,
        color: sobreImagem ? '#F2F2F2' : cor,
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: cor }} />
      {texto}
    </span>
  );
}

export const SeloStatus = ({ estado, sobreImagem }: { estado: EstadoConsumo; sobreImagem?: boolean }) => (
  <Selo texto={NOMES_ESTADO[estado]} tom={estado} sobreImagem={sobreImagem} />
);

export function SeloTop({ posicao }: { posicao: number }) {
  return (
    <div className="flex flex-col items-center rounded-bl-md bg-marca px-1.5 pb-0.5 font-bold text-sobre-marca" aria-label={`Top 10, número ${posicao}`}>
      <span className="text-[11px] leading-[13px]">TOP</span>
      <span className="text-[16px] leading-[18px]">{posicao}</span>
    </div>
  );
}

export function usePosicaoTop10(idMidia: string): number | null {
  const { recorte } = useCatalogo();
  const { data } = usePopulares(recorte);
  const i = data?.slice(0, 10).findIndex((m) => m.id_midia === idMidia) ?? -1;
  return i >= 0 ? i + 1 : null;
}

/** A assinatura: fio carmesim na base do card com Item na Lista. O pai precisa de relative + overflow-hidden. */
export function FioProgresso({ item, grosso }: { item: ItemLista; grosso?: boolean }) {
  const p = proporcaoDoFio(item);
  return (
    <div className={`pointer-events-none absolute inset-x-0 bottom-0 bg-black/45 ${grosso ? 'h-1' : 'h-[3px]'}`}>
      <div className="h-full bg-marca-forte" style={{ width: p === null ? 14 : `${p * 100}%` }} />
    </div>
  );
}

export function Notas({ midia, limite, grande }: { midia: CartaoMidia; limite?: number; grande?: boolean }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-2.5 gap-y-0.5 ${grande ? 'text-[15px]' : 'text-[12px]'}`}>
      {notasDe(midia)
        .slice(0, limite)
        .map((n, i) => (
          <span key={n.rotulo} className="inline-flex items-center gap-1" title={n.rotulo}>
            <Icone nome="estrela" tamanho={grande ? 15 : 12} cheio={i === 0 && n.curto === 'Usuários'} className="text-nota" />
            <b className="text-nota">{n.valor}</b>
            <span className="text-texto-suave">{grande ? n.rotulo : n.curto}</span>
          </span>
        ))}
    </div>
  );
}

// ---------------------------------------------------------------- cards

function Poster({ midia, className = '' }: { midia: CartaoMidia; className?: string }) {
  return midia.poster_url ? (
    <img src={midia.poster_url} alt="" loading="lazy" className={`h-full w-full object-cover ${className}`} />
  ) : (
    <div className="flex h-full items-center justify-center">
      <Monograma tamanho={32} />
    </div>
  );
}

/** Card A (denso): pôster 2:3 com selos e fio; título, Tipo e notas abaixo. */
export function CardA({ midia, largura, comStatus = true }: { midia: CartaoMidia; largura?: number; comStatus?: boolean }) {
  const item = useItemDe(midia.id_midia);
  const top = usePosicaoTop10(midia.id_midia);
  const estado = item ? estadoDe(item.status_consumo, item.tipo) : null;
  const lancamento = emLancamento(midia);
  return (
    <Link
      to="/midia/$id"
      params={{ id: midia.id_midia }}
      className="group/card flex shrink-0 flex-col gap-1.5 outline-none"
      style={largura ? { width: largura } : undefined}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md bg-superficie-alta ring-marca-texto transition group-hover/card:-translate-y-1 group-hover/card:shadow-lg group-focus-visible/card:ring-2">
        <Poster midia={midia} className="transition duration-300 group-hover/card:scale-105" />
        {top ? (
          <div className="absolute right-0 top-0">
            <SeloTop posicao={top} />
          </div>
        ) : null}
        {lancamento || (estado && comStatus) ? (
          <div className="absolute inset-x-1 bottom-1.5 flex flex-col gap-1">
            {lancamento ? <Selo texto={lancamento} tom="marca" /> : null}
            {estado && comStatus ? <SeloStatus estado={estado} sobreImagem /> : null}
          </div>
        ) : null}
        {item ? <FioProgresso item={item} /> : null}
      </div>
      <span className="line-clamp-2 text-[13px] leading-tight text-texto group-hover/card:text-texto-forte">{tituloDe(midia)}</span>
      <Selo texto={NOMES_TIPO[midia.tipo]} />
      <Notas midia={midia} />
    </Link>
  );
}

/** Card C (informativo): horizontal, banner esmaecido ao fundo, pôster pequeno, Status e fio. */
export function CardC({ midia, largura, altura = 150 }: { midia: CartaoMidia; largura?: number; altura?: number }) {
  const item = useItemDe(midia.id_midia);
  const top = usePosicaoTop10(midia.id_midia);
  const estado = item ? estadoDe(item.status_consumo, item.tipo) : null;
  const fundo = midia.banner_url ?? midia.poster_url;
  return (
    <Link
      to="/midia/$id"
      params={{ id: midia.id_midia }}
      className="group/card relative flex shrink-0 overflow-hidden rounded-lg bg-superficie transition hover:ring-1 hover:ring-borda"
      style={{ width: largura, height: altura }}
    >
      {fundo ? (
        <img src={fundo} alt="" className={`absolute inset-0 h-full w-full object-cover opacity-40 ${midia.banner_url ? '' : 'blur-md'}`} />
      ) : null}
      <div className="absolute inset-0 bg-superficie/70" />
      <div className="relative m-2.5 aspect-[2/3] shrink-0 overflow-hidden rounded-md bg-superficie-alta">
        <Poster midia={midia} />
        {top ? (
          <div className="absolute right-0 top-0">
            <SeloTop posicao={top} />
          </div>
        ) : null}
      </div>
      <div className="relative flex min-w-0 flex-1 flex-col justify-center gap-1 py-2 pr-3">
        <Selo texto={NOMES_TIPO[midia.tipo]} />
        <span className="line-clamp-2 font-bold text-texto-forte">{tituloDe(midia)}</span>
        <Notas midia={midia} />
        {estado ? <SeloStatus estado={estado} /> : null}
        {item && temProgresso(item.tipo) ? (
          <span className="text-[12px] text-texto-suave">
            {UNIDADE[item.tipo]}: {item.progresso_atual ?? 0}
            {totalDoItem(item) ? ` de ${totalDoItem(item)}` : ''}
          </span>
        ) : null}
      </div>
      {item ? <FioProgresso item={item} /> : null}
    </Link>
  );
}

// ---------------------------------------------------------------- fileiras

export function TituloSecao({ children, cor, direita }: { children: ReactNode; cor?: string; direita?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <h2 className="text-[20px] font-bold text-texto-forte" style={cor ? { color: cor } : undefined}>
        {children}
      </h2>
      {direita}
    </div>
  );
}

/** Fileira rolável na horizontal, com setas que aparecem no hover. Vazia some (Resolution do 29). */
export function Fileira({ titulo, children, vazia, recuo = 'px-12' }: { titulo: string; children: ReactNode; vazia: boolean; recuo?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  if (vazia) return null;
  const rolar = (d: 1 | -1) => ref.current?.scrollBy({ left: d * ref.current.clientWidth * 0.85, behavior: 'smooth' });
  const seta = 'absolute inset-y-0 z-10 hidden w-12 items-center justify-center bg-fundo/70 text-texto-forte group-hover:flex hover:bg-fundo/90';
  return (
    <section className="group relative">
      <div className={recuo}>
        <TituloSecao>{titulo}</TituloSecao>
      </div>
      <div className="relative">
        <button className={`${seta} left-0`} onClick={() => rolar(-1)} aria-label="Anterior">
          <Icone nome="esquerda" tamanho={28} />
        </button>
        <div ref={ref} className={`sem-barra flex gap-3 overflow-x-auto scroll-smooth ${recuo}`}>
          {children}
        </div>
        <button className={`${seta} right-0`} onClick={() => rolar(1)} aria-label="Seguinte">
          <Icone nome="direita" tamanho={28} />
        </button>
      </div>
    </section>
  );
}

/** Top 10 estilo streaming: numeral grande vazado ao lado do pôster. */
export function CardTop({ midia, posicao }: { midia: CartaoMidia; posicao: number }) {
  return (
    <Link to="/midia/$id" params={{ id: midia.id_midia }} className="group/card flex shrink-0 items-end">
      <span
        className="-mr-4 select-none text-[150px] font-bold leading-[0.8] text-fundo"
        style={{ WebkitTextStroke: '3px var(--cor-borda)' }}
      >
        {posicao}
      </span>
      <div className="relative z-10 aspect-[2/3] w-[130px] overflow-hidden rounded-md bg-superficie-alta transition group-hover/card:-translate-y-1">
        <Poster midia={midia} />
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------- stepper e linha do Item

export function Stepper({ item }: { item: ItemLista }) {
  const mudar = useMudarProgresso();
  const total = totalDoItem(item);
  const atual = item.progresso_atual ?? 0;
  const botao = (delta: 1 | -1) => {
    const novo = passo(item, delta);
    return (
      <button
        disabled={novo === null}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (novo !== null) mudar.mutate({ item, progresso: novo });
        }}
        className="flex h-8 w-8 items-center justify-center text-texto-forte hover:text-marca-texto disabled:text-borda"
        aria-label={delta === 1 ? 'Mais um' : 'Menos um'}
      >
        <Icone nome={delta === 1 ? 'mais' : 'menos'} tamanho={16} />
      </button>
    );
  };
  if (!temProgresso(item.tipo)) return <span className="text-[13px] text-texto-suave">{atual} h</span>;
  return (
    <div className="flex items-center rounded-full border border-borda bg-superficie-alta">
      {botao(-1)}
      <span className="min-w-12 text-center text-[13px] font-semibold tabular-nums text-texto-forte">{total !== null ? `${atual}/${total}` : atual}</span>
      {botao(1)}
    </div>
  );
}

/** Linha do Item no estilo do card C, mais larga no desktop: clique abre o editor. */
export function LinhaItem({ item, editar, comStatus = true }: { item: ItemLista; editar(): void; comStatus?: boolean }) {
  const estado = estadoDe(item.status_consumo, item.tipo);
  const fundo = item.banner_url ?? item.poster_url;
  const rec = recontagem(item);
  return (
    <div className="group relative flex h-[116px] overflow-hidden rounded-lg bg-superficie transition hover:ring-1 hover:ring-borda">
      {fundo ? <img src={fundo} alt="" className={`absolute inset-0 h-full w-full object-cover opacity-35 ${item.banner_url ? '' : 'blur-md'}`} /> : null}
      <div className="absolute inset-0 bg-gradient-to-r from-superficie via-superficie/85 to-superficie/60" />
      <button onClick={editar} className="relative flex min-w-0 flex-1 gap-3 p-2.5 text-left">
        <div className="aspect-[2/3] h-full shrink-0 overflow-hidden rounded-md bg-superficie-alta">
          <Poster midia={item} />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <Selo texto={NOMES_TIPO[item.tipo]} />
          <span className="line-clamp-1 font-bold text-texto-forte group-hover:underline">{tituloDe(item)}</span>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px]">
            {estado && comStatus ? <SeloStatus estado={estado} /> : null}
            {item.nota_usuario != null ? (
              <span className="inline-flex items-center gap-1 font-bold text-nota">
                <Icone nome="estrela" tamanho={13} cheio /> {item.nota_usuario}
              </span>
            ) : null}
            {item.favorito ? <Icone nome="coracao" tamanho={13} cheio className="text-marca-texto" /> : null}
            {item.privado ? <Icone nome="cadeado" tamanho={13} className="text-texto-suave" /> : null}
            {rec ? <span className="text-texto-suave">{rec}</span> : null}
          </div>
          <span className="line-clamp-1 text-[12px] text-texto-suave">{item.generos_lista.slice(0, 3).join(' · ')}</span>
        </div>
      </button>
      <div className="relative flex items-end pb-3 pr-3">
        <Stepper item={item} />
      </div>
      <FioProgresso item={item} />
    </div>
  );
}

// ---------------------------------------------------------------- botões e painéis

export function BotaoMarca({ children, onClick, grande }: { children: ReactNode; onClick?(): void; grande?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 rounded-md bg-marca font-bold text-sobre-marca transition hover:bg-marca-forte ${grande ? 'px-6 py-3 text-[16px]' : 'px-4 py-2'}`}
    >
      {children}
    </button>
  );
}

/** Opções em pílulas (filtros). */
export function Pilulas<T extends string | null>({ opcoes, valor, mudar }: { opcoes: [T, string][]; valor: T; mudar(v: T): void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opcoes.map(([v, nome]) => (
        <button
          key={String(v)}
          onClick={() => mudar(v)}
          className={`rounded-full border px-3 py-1 text-[13px] ${v === valor ? 'border-marca bg-marca text-sobre-marca' : 'border-borda text-texto hover:border-texto-suave'}`}
        >
          {nome}
        </button>
      ))}
    </div>
  );
}

/** Painel lateral (drawer) da direita, o "sheet" do desktop. */
export function Gaveta({ titulo, aberta, fechar, children }: { titulo: string; aberta: boolean; fechar(): void; children: ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && fechar();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [fechar]);
  return (
    <div className={`fixed inset-0 z-50 ${aberta ? '' : 'pointer-events-none'}`}>
      <div className={`absolute inset-0 bg-black/50 transition-opacity ${aberta ? 'opacity-100' : 'opacity-0'}`} onClick={fechar} />
      <aside
        className={`absolute inset-y-0 right-0 flex w-[400px] flex-col bg-superficie shadow-2xl transition-transform ${aberta ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between border-b border-borda px-5 py-4">
          <h2 className="text-[18px] font-bold text-texto-forte">{titulo}</h2>
          <button onClick={fechar} aria-label="Fechar" className="text-texto-suave hover:text-texto-forte">
            <Icone nome="fechar" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------- editor do Item

/** Editor simples do Item: grava de verdade (PUT /lista/<id> ou POST /lista/adicionar). */
export function EditorItem({ midia, item, fechar }: { midia: CartaoMidia & { numero_episodios?: number | null; numero_capitulos?: number | null }; item: ItemLista | null; fechar(): void }) {
  const gravar = useGravarItem();
  const remover = useRemoverItem();
  const tipo = midia.tipo;
  const [status, setStatus] = useState(item?.status_consumo ?? ROTULOS[tipo].planejado!);
  const [progresso, setProgresso] = useState(String(item?.progresso_atual ?? 0));
  const [nota, setNota] = useState(item?.nota_usuario == null ? '' : String(item.nota_usuario));
  const [favorito, setFavorito] = useState(item?.favorito ?? false);
  const [privado, setPrivado] = useState(item?.privado ?? false);
  const total = item ? totalDoItem(item) : tipo === 'anime' ? midia.numero_episodios : tipo === 'manga' ? midia.numero_capitulos : null;

  async function salvar() {
    await gravar.mutateAsync({
      item,
      idMidia: midia.id_midia,
      dados: {
        status_consumo: status,
        progresso_atual: Number(progresso) || 0,
        nota_usuario: nota === '' ? null : Number(nota),
        favorito,
        privado,
      },
    });
    fechar();
  }

  const campo = 'w-full rounded-md border border-borda bg-superficie-alta px-3 py-2 text-texto-forte outline-none focus:border-marca-texto';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={fechar}>
      <div className="w-[520px] overflow-hidden rounded-xl bg-superficie shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="relative flex h-28 items-end gap-4 overflow-hidden px-5 pb-3">
          {(midia.banner_url ?? midia.poster_url) ? (
            <img src={midia.banner_url ?? midia.poster_url ?? ''} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-superficie to-transparent" />
          <div className="relative">
            <Selo texto={NOMES_TIPO[tipo]} />
            <h2 className="text-[20px] font-bold text-texto-forte">{tituloDe(midia)}</h2>
          </div>
          <button onClick={fechar} className="absolute right-3 top-3 text-white/80 hover:text-white" aria-label="Fechar">
            <Icone nome="fechar" />
          </button>
        </div>
        <div className="flex flex-col gap-4 p-5">
          <div>
            <span className="mb-1.5 block text-[13px] text-texto-suave">Status</span>
            <div className="flex flex-wrap gap-1.5">
              {estadosDoTipo(tipo).map((e) => {
                const rotulo = ROTULOS[tipo][e]!;
                const ativo = rotulo === status;
                return (
                  <button
                    key={e}
                    onClick={() => {
                      setStatus(rotulo);
                      if (e === 'concluido' && total) setProgresso(String(total));
                    }}
                    className="rounded-full border px-3 py-1 text-[13px]"
                    style={{
                      borderColor: ativo ? COR_DO_ESTADO[e] : 'var(--cor-borda)',
                      background: ativo ? `color-mix(in srgb, ${COR_DO_ESTADO[e]} 18%, transparent)` : undefined,
                      color: ativo ? COR_DO_ESTADO[e] : undefined,
                    }}
                  >
                    {NOMES_ESTADO[e]}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <label>
              <span className="mb-1.5 block text-[13px] text-texto-suave">
                {UNIDADE[tipo]}
                {total ? ` (de ${total})` : ''}
              </span>
              <input className={campo} type="number" min={0} value={progresso} onChange={(e) => setProgresso(e.target.value)} />
            </label>
            <label>
              <span className="mb-1.5 block text-[13px] text-texto-suave">Nota pessoal (0 a 10)</span>
              <input className={campo} type="number" min={0} max={10} step={0.5} value={nota} onChange={(e) => setNota(e.target.value)} />
            </label>
          </div>
          <div className="flex gap-5 text-[14px]">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={favorito} onChange={(e) => setFavorito(e.target.checked)} className="accent-[var(--cor-marca)]" /> Favorito
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={privado} onChange={(e) => setPrivado(e.target.checked)} className="accent-[var(--cor-marca)]" /> Privado
            </label>
          </div>
          {gravar.error ? <p className="text-[13px] text-erro">{gravar.error.message}</p> : null}
          <div className="flex items-center justify-between pt-1">
            {item ? (
              <button
                onClick={async () => {
                  await remover.mutateAsync(item);
                  fechar();
                }}
                className="text-[14px] text-erro hover:underline"
              >
                Remover da Lista
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button onClick={fechar} className="rounded-md px-4 py-2 text-texto hover:bg-superficie-alta">
                Cancelar
              </button>
              <BotaoMarca onClick={salvar}>{gravar.isPending ? 'Salvando…' : 'Salvar'}</BotaoMarca>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Botão da Lista: "Adicionar à Lista" ou "Editar", que abre o editor. */
export function BotaoDaLista({ midia, grande, largo }: { midia: CartaoMidia; grande?: boolean; largo?: boolean }) {
  const item = useItemDe(midia.id_midia);
  const [aberto, setAberto] = useState(false);
  if (item === undefined) return null;
  return (
    <>
      <span className={largo ? 'block [&>button]:w-full' : ''}>
        <BotaoMarca grande={grande} onClick={() => setAberto(true)}>
          <Icone nome={item ? 'editar' : 'mais'} tamanho={grande ? 20 : 18} />
          {item ? 'Editar' : 'Adicionar à Lista'}
        </BotaoMarca>
      </span>
      {aberto ? <EditorItem midia={midia} item={item} fechar={() => setAberto(false)} /> : null}
    </>
  );
}
