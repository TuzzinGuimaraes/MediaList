// PROTÓTIPO, eixo `nav` (Q71): "Lateral recolhida" (72px só de ícones, que abre sobre o conteúdo
// no hover ou foco, sem empurrar o layout) × "Topo" (barra horizontal com alvos de ~44px e o nome
// "MediaList" ao lado do monograma, translúcida sobre o banner).
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';

import { lerSessao, NOMES_RECORTE, type Recorte, sair } from './api';
import { useCatalogo } from './catalogo';
import { Monograma } from './componentes';
import { Icone, type NomeIcone } from './icones';
import { useVariante } from './variantes';

const ITENS: { para: '/' | '/explorar' | '/lista' | '/noticias'; nome: string; icone: NomeIcone }[] = [
  { para: '/', nome: 'Início', icone: 'casa' },
  { para: '/explorar', nome: 'Explorar', icone: 'bussola' },
  { para: '/lista', nome: 'Minha Lista', icone: 'lista' },
  { para: '/noticias', nome: 'Notícias', icone: 'jornal' },
];

const RECOLHIDA = 72;
const ABERTA = 256;
const ALTURA_TOPO = 72;

/** Casca da aplicação: escolhe a navegação e reserva o espaço dela (a lateral reserva só os 72px). */
export function Casca({ children }: { children: ReactNode }) {
  const nav = useVariante('nav');
  if (nav === 'lateral')
    return (
      <div style={{ ['--topo' as string]: '0px', ['--esquerda' as string]: `${RECOLHIDA}px` }}>
        <NavLateral />
        <main className="min-h-screen" style={{ paddingLeft: RECOLHIDA }}>
          {children}
        </main>
      </div>
    );
  return (
    <div style={{ ['--topo' as string]: `${ALTURA_TOPO}px`, ['--esquerda' as string]: '0px' }}>
      <NavTopo />
      <main className="min-h-screen">{children}</main>
    </div>
  );
}

function PilulaCatalogo({ vertical, sobreImagem }: { vertical?: boolean; sobreImagem?: boolean }) {
  const { recorte, trocar } = useCatalogo();
  return (
    <div
      aria-label="Catálogo"
      className={`flex rounded-full p-0.5 text-[13px] ${vertical ? 'flex-col rounded-lg' : ''} ${sobreImagem ? 'bg-black/35 backdrop-blur' : 'bg-superficie-alta'}`}
    >
      {(Object.keys(NOMES_RECORTE) as Recorte[]).map((r) => (
        <button
          key={r}
          onClick={() => trocar(r)}
          className={`rounded-full px-3 py-1 font-semibold transition ${vertical ? 'rounded-md text-left' : ''} ${
            r === recorte ? 'bg-marca text-sobre-marca' : sobreImagem ? 'text-white/80 hover:text-white' : 'text-texto-suave hover:text-texto-forte'
          }`}
        >
          {NOMES_RECORTE[r]}
        </button>
      ))}
    </div>
  );
}

function Busca({ sempreAberta, sobreImagem }: { sempreAberta?: boolean; sobreImagem?: boolean }) {
  const navigate = useNavigate();
  const [aberta, setAberta] = useState(!!sempreAberta);
  const [texto, setTexto] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (aberta && !sempreAberta) ref.current?.focus();
  }, [aberta, sempreAberta]);
  const enviar = () => void navigate({ to: '/explorar', search: ((p: object) => ({ ...p, busca: texto || undefined })) as never });
  if (!aberta)
    return (
      <button onClick={() => setAberta(true)} aria-label="Buscar" className={sobreImagem ? 'text-white' : 'text-texto-forte'}>
        <Icone nome="busca" />
      </button>
    );
  return (
    <label
      className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 ${sobreImagem ? 'border-white/40 bg-black/50 text-white' : 'border-borda bg-superficie-alta text-texto-forte'}`}
    >
      <Icone nome="busca" tamanho={16} />
      <input
        ref={ref}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && enviar()}
        onBlur={() => !sempreAberta && !texto && setAberta(false)}
        placeholder="Títulos, gêneros…"
        className="w-52 bg-transparent text-[14px] outline-none placeholder:text-current placeholder:opacity-60"
      />
    </label>
  );
}

function Avatar({ sobreImagem, acima }: { sobreImagem?: boolean; acima?: boolean }) {
  const [aberto, setAberto] = useState(false);
  const usuario = lerSessao()?.usuario;
  const inicial = usuario?.nome.trim()[0]?.toUpperCase() ?? '?';
  return (
    <div className="relative">
      <button onClick={() => setAberto((a) => !a)} className="flex items-center gap-1.5" aria-label="Conta">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-marca font-bold text-sobre-marca">{inicial}</span>
        <Icone nome="baixo" tamanho={14} className={`${sobreImagem ? 'text-white' : 'text-texto-suave'} ${aberto ? 'rotate-180' : ''}`} />
      </button>
      {aberto ? (
        <div
          className={`absolute z-50 w-60 overflow-hidden rounded-lg border border-borda bg-superficie shadow-xl ${acima ? 'bottom-11 left-0' : 'right-0 top-11'}`}
          onMouseLeave={() => setAberto(false)}
        >
          <div className="border-b border-borda px-4 py-3">
            <p className="font-semibold text-texto-forte">{usuario?.nome}</p>
            <p className="text-[12px] text-texto-suave">{usuario?.email}</p>
          </div>
          <Link to="/perfil" className="block px-4 py-2 text-[14px] hover:bg-superficie-alta">
            Perfil e estatísticas
          </Link>
          {/* No web real, só para o Nível de acesso admin; no protótipo aparece sempre. */}
          <Link to="/admin" className="flex items-center gap-2 px-4 py-2 text-[14px] hover:bg-superficie-alta">
            <Icone nome="escudo" tamanho={15} /> Administração
          </Link>
          <button onClick={sair} className="flex w-full items-center gap-2 px-4 py-2 text-left text-[14px] hover:bg-superficie-alta">
            <Icone nome="sair" tamanho={15} /> Sair
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Topo estilo streaming: translúcido sobre o banner (Início e detalhe), sólido ao rolar. */
function NavTopo() {
  const { pathname } = useLocation();
  const [rolou, setRolou] = useState(false);
  useEffect(() => {
    const ver = () => setRolou(window.scrollY > 40);
    ver();
    window.addEventListener('scroll', ver, { passive: true });
    return () => window.removeEventListener('scroll', ver);
  }, []);
  const temBanner = pathname === '/' || pathname.startsWith('/midia/');
  const sobre = temBanner && !rolou;
  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 flex items-center gap-8 px-12 transition-colors duration-300 ${
        sobre ? 'bg-gradient-to-b from-black/75 to-transparent' : 'border-b border-borda bg-nav'
      }`}
      style={{ height: ALTURA_TOPO }}
    >
      <Link to="/" className="flex items-center gap-2.5">
        <Monograma tamanho={34} />
        <span className={`text-[20px] font-bold ${sobre ? 'text-white' : 'text-texto-forte'}`}>MediaList</span>
      </Link>
      <nav className="flex items-center gap-1 text-[16px]">
        {ITENS.map((i) => (
          <Link
            key={i.para}
            to={i.para}
            activeOptions={{ exact: i.para === '/', includeSearch: false }}
            className={`flex h-11 items-center rounded-md px-4 font-semibold ${sobre ? 'text-white/80 hover:bg-white/10 hover:text-white' : 'text-texto-suave hover:bg-superficie-alta hover:text-texto-forte'}`}
            activeProps={{ className: `font-bold ${sobre ? '!text-white bg-white/15' : '!text-texto-forte bg-superficie-alta'}` }}
          >
            {i.nome}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-5">
        <PilulaCatalogo sobreImagem={sobre} />
        <Busca sobreImagem={sobre} />
        <Avatar sobreImagem={sobre} />
      </div>
    </header>
  );
}

/**
 * Lateral recolhida: 72px com os ícones (tooltip nativo pelo `title`). No hover ou com o foco
 * dentro, abre para 256px por cima do conteúdo, com uma animação curta e um atraso pequeno no
 * hover para não abrir quando o mouse só passa por ela.
 */
function NavLateral() {
  const { recorte, trocar } = useCatalogo();
  const [hover, setHover] = useState(false);
  const [foco, setFoco] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const aberta = hover || foco;
  const entrar = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setHover(true), 120);
  };
  const sairDela = () => {
    window.clearTimeout(timer.current);
    setHover(false);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const rotulo = `whitespace-nowrap transition-opacity duration-150 ${aberta ? 'opacity-100' : 'pointer-events-none opacity-0'}`;
  return (
    <aside
      onMouseEnter={entrar}
      onMouseLeave={sairDela}
      onFocus={() => setFoco(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setFoco(false)}
      className={`fixed inset-y-0 left-0 z-40 flex flex-col gap-5 overflow-x-hidden border-r border-borda bg-nav px-3 py-5 transition-[width,box-shadow] duration-200 ease-out ${
        aberta ? 'shadow-[8px_0_32px_rgba(0,0,0,0.45)]' : ''
      }`}
      style={{ width: aberta ? ABERTA : RECOLHIDA }}
    >
      <Link to="/" className="flex h-10 items-center gap-3 px-2.5" title="MediaList">
        <span className="flex w-7 shrink-0 justify-center">
          <Monograma tamanho={32} />
        </span>
        <span className={`text-[18px] font-bold text-texto-forte ${rotulo}`}>MediaList</span>
      </Link>
      {aberta ? (
        <div className="px-0.5">
          <PilulaCatalogo vertical />
        </div>
      ) : (
        <button
          onClick={() => trocar(recorte === 'animanga' ? 'jogos' : 'animanga')}
          title={`Catálogo: ${NOMES_RECORTE[recorte]}`}
          className="mx-auto h-[58px] w-12 shrink-0 rounded-md bg-marca text-[11px] font-bold text-sobre-marca"
        >
          {recorte === 'animanga' ? 'A&M' : 'Jogos'}
        </button>
      )}
      <BuscaLateral aberta={aberta} />
      <nav className="flex flex-col gap-1">
        {ITENS.map((i) => (
          <Link
            key={i.para}
            to={i.para}
            title={i.nome}
            activeOptions={{ exact: i.para === '/', includeSearch: false }}
            className="flex h-11 items-center gap-3 rounded-md px-3 text-texto-suave hover:bg-superficie-alta hover:text-texto-forte"
            activeProps={{ className: '!bg-superficie-alta !text-texto-forte font-bold shadow-[inset_3px_0_0_var(--cor-marca)]' }}
          >
            <span className="flex w-6 shrink-0 justify-center">
              <Icone nome={i.icone} />
            </span>
            <span className={rotulo}>{i.nome}</span>
          </Link>
        ))}
      </nav>
      <div className="mt-auto px-1">
        <Avatar acima />
      </div>
    </aside>
  );
}

/** Busca da lateral: recolhida é só a lupa; clicar foca o campo, e o foco abre a lateral. */
function BuscaLateral({ aberta }: { aberta: boolean }) {
  const navigate = useNavigate();
  const [texto, setTexto] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const enviar = () => void navigate({ to: '/explorar', search: ((p: object) => ({ ...p, busca: texto || undefined })) as never });
  return (
    <label
      title="Buscar"
      onClick={() => ref.current?.focus()}
      className={`flex h-11 shrink-0 cursor-text items-center gap-3 rounded-md px-3 text-texto-forte ${aberta ? 'border border-borda bg-superficie-alta' : 'hover:bg-superficie-alta'}`}
    >
      <span className="flex w-6 shrink-0 justify-center">
        <Icone nome="busca" />
      </span>
      <input
        ref={ref}
        value={texto}
        tabIndex={aberta ? 0 : -1}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && enviar()}
        placeholder="Títulos, gêneros…"
        className={`min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-texto-suave ${aberta ? '' : 'w-0 opacity-0'}`}
      />
    </label>
  );
}
