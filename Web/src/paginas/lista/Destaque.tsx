// Cartão de destaque das linhas (veredito do ticket 39): banner, título, sinopse curta,
// Tipo/Situação/ano, nota, Progresso/horas, Status e "Ver detalhes", para mostrar uma Mídia a
// alguém sem depender do cursor. Abre com o mouse parado ~300 ms numa linha ou com o foco de
// teclado no título; fecha ao sair (com tolerância para o mouse chegar ao cartão), com Esc,
// ao rolar e ao redimensionar.
//
// Padrão ARIA: diálogo não modal (role="dialog", sem aria-modal) com foco gerenciado, como um
// popover. Não é tooltip porque tem um link dentro, e tooltip não recebe foco. Abrir não
// rouba o foco do título (o cartão é uma prévia; quem navega por Tab não é arrancado da
// Lista), e o título aponta para ele com aria-describedby, então o leitor de tela lê o
// destaque junto. O cartão fica no fim do <body> (o `transform` da virtualização prenderia o
// `position: fixed`), então o foco é costurado como o de um popover nativo: Tab no título
// entra no cartão, Tab no cartão segue para o que vem depois do título, Shift+Tab volta ao
// título e Esc fecha e devolve o foco ao título.
import { Link } from '@tanstack/react-router';
import {
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

import { estadoDe, NOMES_ESTADO, nomeDoTipo } from '@dominio/estadoConsumo';
import { tituloDaMidia } from '@dominio/midia';
import { nomeDaSituacao, situacaoDe } from '@dominio/situacao';

import { Monograma } from '../../componentes/Monograma';
import { COR_DO_ESTADO } from '../../componentes/status';
import { ALTURA_NAV } from '../../layout/Casca';
import { type Ancora, type Destaque, DestaqueCtx } from './destaqueContexto';
import { Consumo, Nota, PontoStatus } from './Pecas';
import { FOCO } from './MenuStatus';
import { textos } from './textos';

const ESPERA = 300;
const TOLERANCIA = 220;
/** Focar um título perto da borda rola a página até ele; essa rolagem não fecha o cartão. */
const ROLAGEM_DO_FOCO = 150;
const LARGURA = 320;
const MARGEM = 12;

const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]';

/**
 * Teclado ou ponteiro, pela última interação: o clique também foca o título, e só o foco de
 * teclado abre o cartão (o mouse abre pelo hover).
 */
function useModalidadeTeclado() {
  const teclado = useRef(false);
  useEffect(() => {
    const tecla = () => (teclado.current = true);
    const ponteiro = () => (teclado.current = false);
    document.addEventListener('keydown', tecla, true);
    document.addEventListener('pointerdown', ponteiro, true);
    document.addEventListener('mousedown', ponteiro, true);
    return () => {
      document.removeEventListener('keydown', tecla, true);
      document.removeEventListener('pointerdown', ponteiro, true);
      document.removeEventListener('mousedown', ponteiro, true);
    };
  }, []);
  return teclado;
}

/** O próximo (ou anterior) elemento focável da página depois de `el`, fora do cartão. */
function vizinho(el: HTMLElement, passo: 1 | -1, cartao: HTMLElement | null): HTMLElement | null {
  const todos = [...document.querySelectorAll<HTMLElement>(FOCAVEIS)].filter((x) => x.tabIndex >= 0 && !cartao?.contains(x));
  const i = todos.indexOf(el);
  return i < 0 ? null : (todos[i + passo] ?? null);
}

/** Estado do cartão para a Lista inteira (um só aberto por vez), e o cartão por cima de tudo. */
export function ProvedorDestaque({ children }: { children: ReactNode }) {
  const [ancora, setAncora] = useState<Ancora | null>(null);
  const atual = useRef<Ancora | null>(null);
  const abertoEm = useRef(0);
  const timer = useRef(0);
  const cartao = useRef<HTMLDivElement>(null);
  /** Esc devolve o foco ao título: esse foco não reabre o cartão. */
  const semReabrir = useRef<string | null>(null);
  const teclado = useModalidadeTeclado();
  const idCartao = useId();

  const abrir = useCallback((a: Ancora | null) => {
    atual.current = a;
    abertoEm.current = Date.now();
    setAncora(a);
  }, []);

  const destacar = useCallback(
    (a: Ancora) => {
      clearTimeout(timer.current);
      if (a.origem === 'foco') {
        if (!teclado.current || semReabrir.current === a.item.id_lista) {
          semReabrir.current = null;
          return;
        }
        if (atual.current?.item.id_lista !== a.item.id_lista) abrir(a);
        else atual.current = { ...atual.current, titulo: a.titulo };
        return;
      }
      // Já aberto nesta linha: só cancela um fechamento pendente.
      if (atual.current?.item.id_lista === a.item.id_lista) return;
      // "Parado": cada movimento recomeça a espera.
      timer.current = window.setTimeout(() => abrir(a), ESPERA);
    },
    [abrir, teclado],
  );
  const soltar = useCallback(
    (imediato = false) => {
      clearTimeout(timer.current);
      if (imediato) abrir(null);
      else timer.current = window.setTimeout(() => abrir(null), TOLERANCIA);
    },
    [abrir],
  );
  const segurar = useCallback(() => clearTimeout(timer.current), []);

  const entrar = useCallback(() => {
    const alvo = cartao.current?.querySelector<HTMLElement>(FOCAVEIS);
    if (!alvo) return false;
    clearTimeout(timer.current);
    alvo.focus({ preventScroll: true });
    return true;
  }, []);

  /** Esc: fecha; se o foco estava no cartão ou no título, volta ao título. */
  const fecharComEsc = useCallback(() => {
    const a = atual.current;
    const ativo = document.activeElement;
    abrir(null);
    if (a?.titulo && (cartao.current?.contains(ativo) || ativo === a.titulo)) {
      if (ativo !== a.titulo) {
        semReabrir.current = a.item.id_lista;
        a.titulo.focus();
      }
    }
  }, [abrir]);

  useEffect(() => {
    if (!ancora) return;
    const rolar = () => {
      if (ancora.origem === 'foco' && Date.now() - abertoEm.current < ROLAGEM_DO_FOCO) return;
      soltar(true);
    };
    const fechar = () => soltar(true);
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') fecharComEsc();
    };
    addEventListener('scroll', rolar, { passive: true });
    addEventListener('resize', fechar);
    addEventListener('keydown', esc);
    return () => {
      removeEventListener('scroll', rolar);
      removeEventListener('resize', fechar);
      removeEventListener('keydown', esc);
    };
  }, [ancora, soltar, fecharComEsc]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const valor = useMemo<Destaque>(
    () => ({ aberto: ancora?.item.id_lista ?? null, idCartao, destacar, soltar, entrar }),
    [ancora, idCartao, destacar, soltar, entrar],
  );

  /** Tab e Shift+Tab dentro do cartão: seguem do título, como se o cartão estivesse logo depois dele. */
  const teclasDoCartao = (e: KeyboardEvent) => {
    const titulo = atual.current?.titulo;
    if (e.key !== 'Tab' || !titulo) return;
    const focaveis = [...(cartao.current?.querySelectorAll<HTMLElement>(FOCAVEIS) ?? [])];
    const i = focaveis.indexOf(document.activeElement as HTMLElement);
    const alvo = e.shiftKey ? (i <= 0 ? titulo : null) : i === focaveis.length - 1 ? vizinho(titulo, 1, cartao.current) : null;
    if (!alvo) return;
    e.preventDefault();
    alvo.focus();
  };

  return (
    <DestaqueCtx.Provider value={valor}>
      {children}
      {ancora
        ? createPortal(
            <CartaoDestaque
              key={ancora.item.id_lista}
              caixa={cartao}
              id={idCartao}
              ancora={ancora}
              segurar={segurar}
              soltar={(e?: FocusEvent) => {
                // Foco saindo do cartão para o título: o título segura.
                if (e && cartao.current?.contains(e.relatedTarget as Node)) return;
                soltar();
              }}
              teclas={teclasDoCartao}
            />,
            document.body,
          )
        : null}
    </DestaqueCtx.Provider>
  );
}

/** Ao lado do cursor (ou do título, no foco); vira para a esquerda e sobe para caber na tela. */
function posicao(a: Ancora, altura: number) {
  const ref = a.x ?? a.linha.left + Math.min(a.linha.width * 0.42, 440);
  let left = ref + 24;
  if (left + LARGURA > innerWidth - MARGEM) left = ref - 24 - LARGURA;
  left = Math.max(MARGEM, Math.min(left, innerWidth - LARGURA - MARGEM));
  const topoMinimo = ALTURA_NAV + MARGEM;
  let top = a.linha.top - 12;
  if (top + altura > innerHeight - MARGEM) top = a.linha.bottom - altura + 12;
  top = Math.max(topoMinimo, Math.min(top, innerHeight - altura - MARGEM));
  return { left, top };
}

type PropsCartao = {
  caixa: RefObject<HTMLDivElement | null>;
  id: string;
  ancora: Ancora;
  segurar(): void;
  soltar(e?: FocusEvent): void;
  teclas(e: KeyboardEvent): void;
};

function CartaoDestaque({ caixa, id, ancora, segurar, soltar, teclas }: PropsCartao) {
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (caixa.current) setPos(posicao(ancora, caixa.current.offsetHeight));
  }, [ancora, caixa]);

  const { item } = ancora;
  const titulo = tituloDaMidia(item);
  const estado = estadoDe(item.status_consumo, item.tipo);
  const situacao = situacaoDe(item);
  const fundo = item.banner_url ?? item.poster_url;
  const dados = [nomeDoTipo(item.tipo), situacao ? nomeDaSituacao(situacao) : null, item.data_lancamento?.slice(0, 4)].filter(Boolean).join(' · ');
  return (
    <div
      ref={caixa}
      id={id}
      role="dialog"
      aria-label={textos.destaque(titulo)}
      onMouseEnter={segurar}
      onMouseLeave={() => soltar()}
      onFocus={segurar}
      onBlur={soltar}
      onKeyDown={teclas}
      className="fixed z-50 overflow-hidden rounded-xl border border-borda bg-superficie-alta shadow-[0_16px_48px_rgba(0,0,0,0.55)] motion-safe:animate-[surgir_140ms_ease-out]"
      style={{ width: LARGURA, left: pos?.left ?? -9999, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' }}
    >
      <div className="relative h-[104px] overflow-hidden bg-superficie">
        {fundo ? <img src={fundo} alt="" className={`h-full w-full object-cover ${item.banner_url ? '' : 'scale-125 blur-md'}`} /> : null}
        <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-superficie-alta via-superficie-alta/30 to-transparent" />
      </div>
      <div className="relative -mt-12 flex gap-3 px-3.5">
        <span className="flex h-[84px] w-14 shrink-0 items-center justify-center overflow-hidden rounded-md bg-superficie shadow-lg ring-1 ring-black/40">
          {item.poster_url ? <img src={item.poster_url} alt="" className="h-full w-full object-cover" /> : <Monograma tamanho={20} rotulo={null} />}
        </span>
        <div className="flex min-w-0 flex-col justify-end pb-0.5">
          <p className="line-clamp-2 text-[15px] font-bold leading-tight text-texto-forte">{titulo}</p>
          {dados ? <p className="mt-1 truncate text-[12px] text-texto-suave">{dados}</p> : null}
        </div>
      </div>
      <div className="flex flex-col gap-3 px-3.5 pb-3.5 pt-3">
        {item.sinopse ? (
          <p className="line-clamp-3 text-[13px] leading-snug text-texto">{item.sinopse}</p>
        ) : (
          <p className="text-[13px] italic text-texto-suave">{textos.semSinopse}</p>
        )}
        <div className="flex items-center gap-4">
          <Nota nota={item.nota_usuario} tamanho={14} />
          <Consumo item={item} tamanho={14} />
          {estado ? (
            <span className="ml-auto inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: COR_DO_ESTADO[estado] }}>
              <PontoStatus estado={estado} /> {NOMES_ESTADO[estado]}
            </span>
          ) : null}
        </div>
        <Link
          to="/midia/$id"
          params={{ id: item.id_midia }}
          className={`inline-flex h-9 items-center justify-center rounded-lg bg-marca-forte px-4 text-[13px] font-semibold text-sobre-marca transition-colors hover:bg-marca ${FOCO}`}
        >
          {textos.verDetalhes}
        </Link>
      </div>
    </div>
  );
}
