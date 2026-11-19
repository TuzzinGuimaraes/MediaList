import { useNavigate } from '@tanstack/react-router';
import { type FormEvent, useEffect, useRef, useState } from 'react';

import { Icone } from '../componentes/Icone';

/** Lupa da nav: abre um campo; Enter leva ao Explorar com a busca. */
export function BuscaNav({ sobreImagem }: { sobreImagem: boolean }) {
  const navigate = useNavigate();
  const [aberta, setAberta] = useState(false);
  const [texto, setTexto] = useState('');
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (aberta) campo.current?.focus();
  }, [aberta]);

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const busca = texto.trim();
    void navigate({ to: '/explorar', search: busca ? { busca } : {} });
  };

  const cor = sobreImagem ? 'text-white' : 'text-texto-forte';
  if (!aberta) {
    return (
      <button
        type="button"
        aria-label="Buscar"
        onClick={() => setAberta(true)}
        className={`flex h-11 w-11 items-center justify-center rounded-md outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-marca-texto ${cor}`}
      >
        <Icone nome="busca" />
      </button>
    );
  }
  return (
    <form role="search" onSubmit={enviar}>
      <label
        className={`flex h-11 items-center gap-2 rounded-md border px-3 ${
          sobreImagem ? 'border-white/40 bg-black/50 text-white' : 'border-borda bg-superficie-alta text-texto-forte'
        }`}
      >
        <Icone nome="busca" tamanho={16} />
        <input
          ref={campo}
          type="search"
          aria-label="Buscar"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={() => !texto && setAberta(false)}
          onKeyDown={(e) => e.key === 'Escape' && (setTexto(''), setAberta(false))}
          placeholder="Títulos, gêneros…"
          className="w-52 bg-transparent text-[14px] outline-none placeholder:text-current placeholder:opacity-60"
        />
      </label>
    </form>
  );
}
