// Casca das telas autenticadas: nav no topo (Resolution do 19), translúcida sobre o
// destaque e sólida ao rolar; abaixo de 1024px, os itens vão para um menu. Rotas com destaque marcam `staticData: { destaque: true }`
// e desenham por baixo da nav; as outras começam abaixo dela.
import { Link, Outlet, useMatches } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

import { Icone } from '../componentes/Icone';
import { Monograma } from '../componentes/Monograma';
import { useSessao } from '../sessao/SessaoContext';
import { BuscaNav } from './BuscaNav';
import { MenuConta } from './MenuConta';
import { PilulaCatalogo } from './PilulaCatalogo';
import { SinoNotificacoes } from './SinoNotificacoes';
import { useTelaLarga } from './telaLarga';

export const ALTURA_NAV = 72;
/** Quanto rolar até a nav ficar sólida. */
const ROLAGEM_SOLIDA = 40;

const ITENS = [
  { para: '/', nome: 'Início' },
  { para: '/explorar', nome: 'Explorar' },
  { para: '/lista', nome: 'Minha Lista' },
  { para: '/noticias', nome: 'Notícias' },
] as const;

function useRolou(): boolean {
  const [rolou, setRolou] = useState(() => window.scrollY > ROLAGEM_SOLIDA);
  useEffect(() => {
    const ver = () => setRolou(window.scrollY > ROLAGEM_SOLIDA);
    window.addEventListener('scroll', ver, { passive: true });
    return () => window.removeEventListener('scroll', ver);
  }, []);
  return rolou;
}

function itemDaNav(sobreDestaque: boolean) {
  return {
    className: `flex h-11 items-center rounded-md px-4 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-marca-texto ${
      sobreDestaque
        ? 'text-white/80 hover:bg-white/10 hover:text-white'
        : 'text-texto-suave hover:bg-superficie-alta hover:text-texto-forte'
    }`,
    activeProps: {
      'aria-current': 'page' as const,
      className: `font-bold ${sobreDestaque ? '!text-white bg-white/15' : '!text-texto-forte bg-superficie-alta'}`,
    },
  };
}

/** Desktop: os itens em linha. */
function ItensEmLinha({ sobreDestaque }: { sobreDestaque: boolean }) {
  return (
    <nav aria-label="Principal" className="flex items-center gap-1 text-[16px]">
      {ITENS.map((i) => (
        <Link key={i.para} to={i.para} activeOptions={{ exact: i.para === '/', includeSearch: false }} {...itemDaNav(sobreDestaque)}>
          {i.nome}
        </Link>
      ))}
    </nav>
  );
}

/** Abaixo de 1024px: os itens num menu que abre do botão; navegar, Esc ou clicar fora fecham. */
function ItensEmMenu({ sobreDestaque }: { sobreDestaque: boolean }) {
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('pointerdown', fora);
    return () => document.removeEventListener('pointerdown', fora);
  }, [aberto]);

  return (
    <nav
      ref={raiz}
      aria-label="Principal"
      className="relative"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && aberto) {
          setAberto(false);
          botao.current?.focus();
        }
      }}
    >
      <button
        ref={botao}
        type="button"
        aria-label="Menu"
        aria-expanded={aberto}
        aria-controls="menu-principal"
        onClick={() => setAberto((a) => !a)}
        className={`flex h-11 w-11 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-marca-texto ${
          sobreDestaque ? 'text-white hover:bg-white/10' : 'text-texto-forte hover:bg-superficie-alta'
        }`}
      >
        <Icone nome={aberto ? 'fechar' : 'menu'} />
      </button>
      {aberto ? (
        <div
          id="menu-principal"
          className="absolute left-0 top-12 z-50 flex w-56 flex-col gap-1 rounded-lg border border-borda bg-superficie p-2 text-[16px] shadow-xl"
        >
          {ITENS.map((i) => (
            <Link
              key={i.para}
              to={i.para}
              activeOptions={{ exact: i.para === '/', includeSearch: false }}
              onClick={() => setAberto(false)}
              {...itemDaNav(false)}
            >
              {i.nome}
            </Link>
          ))}
        </div>
      ) : null}
    </nav>
  );
}

function NavTopo({ sobreDestaque }: { sobreDestaque: boolean }) {
  const larga = useTelaLarga();
  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 flex items-center gap-3 px-6 transition-colors duration-300 lg:gap-8 lg:px-12 ${
        sobreDestaque ? 'bg-gradient-to-b from-black/75 to-transparent' : 'border-b border-borda bg-nav'
      }`}
      style={{ height: ALTURA_NAV }}
    >
      {larga ? null : <ItensEmMenu sobreDestaque={sobreDestaque} />}
      <Link to="/" className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-marca-texto">
        <Monograma tamanho={34} rotulo={null} />
        <span className={`sr-only text-[20px] font-bold lg:not-sr-only ${sobreDestaque ? 'text-white' : 'text-texto-forte'}`}>MediaList</span>
      </Link>
      {larga ? <ItensEmLinha sobreDestaque={sobreDestaque} /> : null}
      <div className="ml-auto flex items-center gap-2 lg:gap-4">
        <PilulaCatalogo sobreImagem={sobreDestaque} />
        <BuscaNav sobreImagem={sobreDestaque} />
        <SinoNotificacoes sobreImagem={sobreDestaque} />
        <MenuConta sobreImagem={sobreDestaque} />
      </div>
    </header>
  );
}

export function Casca() {
  const { estado: sessao } = useSessao();
  const temDestaque = useMatches({ select: (ms) => ms.some((m) => m.staticData.destaque) });
  const rolou = useRolou();
  // Ao sair, a casca ainda renderiza uma vez antes da guarda mandar ao login.
  if (sessao.estado !== 'autenticada') return null;
  return (
    <>
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-marca focus:px-4 focus:py-2 focus:text-sobre-marca"
      >
        Pular para o conteúdo
      </a>
      <NavTopo sobreDestaque={temDestaque && !rolou} />
      <main id="conteudo" className="min-h-screen" style={temDestaque ? undefined : { paddingTop: ALTURA_NAV }}>
        <Outlet />
      </main>
    </>
  );
}
