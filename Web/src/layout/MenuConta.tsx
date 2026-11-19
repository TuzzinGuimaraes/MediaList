import { Link } from '@tanstack/react-router';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';

import { Icone } from '../componentes/Icone';
import { ehAdmin } from '../sessao/sessao';
import { useSessao, useUsuario } from '../sessao/SessaoContext';

const ITEM =
  'flex min-h-11 w-full items-center gap-2.5 px-4 text-left text-[14px] text-texto outline-none hover:bg-superficie-alta focus-visible:bg-superficie-alta';

/** Avatar com a inicial e o menu da conta: Perfil, Administração (só admin) e Sair. */
export function MenuConta({ sobreImagem }: { sobreImagem: boolean }) {
  const usuario = useUsuario();
  const { sair } = useSessao();
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const inicial = usuario.nome.trim()[0]?.toUpperCase() ?? '?';

  useEffect(() => {
    if (!aberto) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const fora = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('pointerdown', fora);
    return () => document.removeEventListener('pointerdown', fora);
  }, [aberto]);

  const fechar = (devolverFoco = true) => {
    setAberto(false);
    if (devolverFoco) botao.current?.focus();
  };

  // Setas entre os itens, Esc fecha (padrão de menu da WAI-ARIA).
  const teclado = (e: KeyboardEvent) => {
    if (e.key === 'Escape') return fechar();
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const itens = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const i = itens.indexOf(document.activeElement as HTMLElement);
    const proximo = e.key === 'ArrowDown' ? (i + 1) % itens.length : (i - 1 + itens.length) % itens.length;
    itens[proximo]?.focus();
  };

  return (
    <div ref={raiz} className="relative" onKeyDown={teclado}>
      <button
        ref={botao}
        type="button"
        aria-label="Conta"
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
        className="flex h-11 items-center gap-1.5 rounded-md px-1 outline-none focus-visible:ring-2 focus-visible:ring-marca-texto"
      >
        <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-md bg-marca font-bold text-sobre-marca">
          {inicial}
        </span>
        <Icone
          nome="baixo"
          tamanho={14}
          className={`transition-transform ${sobreImagem ? 'text-white' : 'text-texto-suave'} ${aberto ? 'rotate-180' : ''}`}
        />
      </button>
      {aberto ? (
        <div
          ref={menu}
          role="menu"
          aria-label="Conta"
          className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-lg border border-borda bg-superficie py-1 shadow-xl"
        >
          <div className="border-b border-borda px-4 py-3">
            <p className="truncate font-semibold text-texto-forte">{usuario.nome}</p>
            <p className="truncate text-[12px] text-texto-suave">{usuario.email}</p>
          </div>
          <Link to="/perfil" role="menuitem" className={ITEM} onClick={() => fechar(false)}>
            <Icone nome="usuario" tamanho={16} /> Perfil
          </Link>
          {ehAdmin(usuario) ? (
            <Link to="/admin" role="menuitem" className={ITEM} onClick={() => fechar(false)}>
              <Icone nome="escudo" tamanho={16} /> Administração
            </Link>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className={ITEM}
            onClick={() => {
              fechar(false);
              void sair();
            }}
          >
            <Icone nome="sair" tamanho={16} /> Sair
          </button>
        </div>
      ) : null}
    </div>
  );
}
