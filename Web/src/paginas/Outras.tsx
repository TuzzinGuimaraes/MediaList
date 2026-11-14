// PROTÓTIPO: entrar (login real) e as páginas fora do escopo do protótipo (Notícias, Admin, Perfil).
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { entrar } from '../api';
import { BotaoMarca, Monograma } from '../componentes';

export function Entrar() {
  const navigate = useNavigate();
  // Usuário de dev do seed (README, "Dados de desenvolvimento").
  const [email, setEmail] = useState('teste@medialist.dev');
  const [senha, setSenha] = useState('teste123');
  const [erro, setErro] = useState<string | null>(null);
  const campo = 'w-full rounded-md border border-borda bg-superficie-alta px-3 py-2.5 text-texto-forte outline-none focus:border-marca-texto';
  return (
    <div className="flex min-h-screen items-center justify-center bg-fundo">
      <form
        className="flex w-[380px] flex-col gap-4 rounded-xl border border-borda bg-superficie p-8"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await entrar(email, senha);
            void navigate({ to: '/' });
          } catch (err) {
            setErro((err as Error).message);
          }
        }}
      >
        <div className="mb-2 flex items-center gap-2">
          <Monograma tamanho={40} />
          <span className="text-[22px] font-bold text-texto-forte">MediaList</span>
        </div>
        <input className={campo} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail" />
        <input className={campo} type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha" />
        {erro ? <p className="text-[14px] text-erro">{erro}</p> : null}
        <BotaoMarca>Entrar</BotaoMarca>
        <p className="text-[12px] text-texto-suave">Protótipo: login real em /api/auth/login, token guardado no localStorage.</p>
      </form>
    </div>
  );
}

export function ForaDoPrototipo({ titulo }: { titulo: string }) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 pt-[var(--topo)] text-texto-suave">
      <Monograma tamanho={48} />
      <h1 className="text-[24px] font-bold text-texto-forte">{titulo}</h1>
      <p>Fora do escopo do protótipo de layout (ticket 19).</p>
    </div>
  );
}
