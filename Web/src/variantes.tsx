// PROTÓTIPO (ticket 19, Q68): eixos de layout de desktop, cada um num search param
// (?nav=topo&inicio=a&lista=linhas&explorar=coluna&detalhe=duas&tema=escuro), e a barra
// flutuante que os troca. A barra só existe em dev (import.meta.env.DEV).
import { useLocation, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

export const EIXOS = {
  nav: [
    ['topo', 'Topo'],
    ['lateral', 'Lateral'],
  ],
  inicio: [
    ['a', 'Destaque largo'],
    ['b', 'Destaque + coluna'],
  ],
  lista: [
    ['linhas', 'Abas + linhas'],
    ['grade', 'Abas + grade'],
  ],
  explorar: [
    ['coluna', 'Coluna'],
    ['sheet', 'Sheet'],
  ],
  detalhe: [
    ['duas', 'Duas colunas'],
    ['central', 'Coluna central'],
  ],
  tema: [
    ['escuro', 'Escuro Carmesim'],
    ['claro', 'Claro Rubi'],
  ],
} as const satisfies Record<string, readonly (readonly [string, string])[]>;

export type Eixo = keyof typeof EIXOS;
export type ValorDe<E extends Eixo> = (typeof EIXOS)[E][number][0];
export type BuscaVariantes = { [E in Eixo]?: ValorDe<E> };

const NOMES_EIXOS = Object.keys(EIXOS) as Eixo[];

/** validateSearch da raiz: só aceita valores conhecidos; o resto vira o padrão (o 1º). */
export function validarVariantes(busca: Record<string, unknown>): BuscaVariantes {
  const saida: Record<string, string> = {};
  for (const eixo of NOMES_EIXOS) {
    const v = busca[eixo];
    if (typeof v === 'string' && EIXOS[eixo].some(([chave]) => chave === v)) saida[eixo] = v;
  }
  return saida as BuscaVariantes;
}

export function useVariante<E extends Eixo>(eixo: E): ValorDe<E> {
  const busca = useSearch({ strict: false }) as BuscaVariantes;
  return (busca[eixo] ?? EIXOS[eixo][0][0]) as ValorDe<E>;
}

/** O tema é um eixo: troca a classe `.claro` no <html> (as variáveis vêm de design/tokens.js). */
export function useAplicarTema() {
  const tema = useVariante('tema');
  useEffect(() => {
    document.documentElement.classList.toggle('claro', tema === 'claro');
  }, [tema]);
}

/** Eixo da página atual, para ser o ativo da barra ao chegar nela. */
function eixoDaRota(caminho: string): Eixo {
  if (caminho.startsWith('/lista')) return 'lista';
  if (caminho.startsWith('/explorar')) return 'explorar';
  if (caminho.startsWith('/midia')) return 'detalhe';
  return caminho === '/' ? 'inicio' : 'nav';
}

function digitando(alvo: EventTarget | null): boolean {
  const el = alvo as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
}

export function BarraVariantes() {
  if (!import.meta.env.DEV) return null;
  return <Barra />;
}

function Barra() {
  const busca = useSearch({ strict: false }) as BuscaVariantes;
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [ativo, setAtivo] = useState<Eixo>(eixoDaRota(pathname));
  const [aberta, setAberta] = useState(true);

  useEffect(() => setAtivo(eixoDaRota(pathname)), [pathname]);

  const valor = (e: Eixo) => busca[e] ?? EIXOS[e][0][0];

  function girar(e: Eixo, delta: 1 | -1) {
    const opcoes = EIXOS[e];
    const i = opcoes.findIndex(([k]) => k === valor(e));
    const proximo = opcoes[(i + delta + opcoes.length) % opcoes.length]![0];
    void navigate({ to: '.', search: ((prev: BuscaVariantes) => ({ ...prev, [e]: proximo })) as never, replace: true });
  }

  useEffect(() => {
    function tecla(ev: KeyboardEvent) {
      if (digitando(ev.target) || ev.altKey || ev.ctrlKey || ev.metaKey) return;
      if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
      ev.preventDefault();
      const delta = ev.key === 'ArrowLeft' ? -1 : 1;
      // Shift+←/→ troca o eixo ativo; ←/→ troca o valor dele. ↑/↓ continuam rolando a página.
      if (ev.shiftKey) {
        const i = NOMES_EIXOS.indexOf(ativo);
        setAtivo(NOMES_EIXOS[(i + delta + NOMES_EIXOS.length) % NOMES_EIXOS.length]!);
      } else girar(ativo, delta);
    }
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  });

  const nome = (e: Eixo) => EIXOS[e].find(([k]) => k === valor(e))?.[1];

  // Visual de ferramenta (amarelo/preto, monoespaçado): não faz parte do design avaliado.
  return (
    <div className="fixed bottom-4 left-1/2 z-[1000] -translate-x-1/2 font-mono text-[12px] text-black">
      {aberta ? (
        <div className="rounded-xl border-2 border-black bg-yellow-300 p-2 shadow-[0_6px_24px_rgba(0,0,0,0.5)]">
          <div className="mb-1 flex items-center justify-between gap-4 px-1">
            <span className="font-bold">PROTÓTIPO · ←→ valor · ⇧←→ eixo</span>
            <button className="rounded border border-black px-1.5 hover:bg-black hover:text-yellow-300" onClick={() => setAberta(false)}>
              recolher ▾
            </button>
          </div>
          <div className="flex max-w-[96vw] flex-wrap justify-center gap-1">
            {NOMES_EIXOS.map((e) => (
              <div
                key={e}
                onClick={() => setAtivo(e)}
                className={`flex cursor-pointer items-center rounded-md border border-black ${e === ativo ? 'bg-black text-yellow-300' : 'bg-yellow-100'}`}
              >
                <button className="px-1.5 py-1 hover:opacity-60" onClick={() => girar(e, -1)} aria-label={`${e} anterior`}>
                  ←
                </button>
                <span className="whitespace-nowrap px-1">
                  {e}: <b>{valor(e)}</b> ({nome(e)})
                </span>
                <button className="px-1.5 py-1 hover:opacity-60" onClick={() => girar(e, 1)} aria-label={`${e} seguinte`}>
                  →
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <button
          className="rounded-full border-2 border-black bg-yellow-300 px-3 py-1 font-bold shadow-[0_6px_24px_rgba(0,0,0,0.5)]"
          onClick={() => setAberta(true)}
        >
          PROTÓTIPO · {ativo}: {valor(ativo)} ▴
        </button>
      )}
    </div>
  );
}
