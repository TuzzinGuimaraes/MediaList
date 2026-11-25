// Administração (só admin, ADR 0012): moderação de Usuários (ativar/desativar, paginado), das
// Avaliações recentes (excluir) e dos vínculos de Não encontrados (desfazer). Ninguém ativa ou
// desativa a si mesmo nem outro admin.
import { useState } from 'react';

import { AvaliacoesAdmin } from './AvaliacoesAdmin';
import { UsuariosAdmin } from './UsuariosAdmin';
import { VinculosAdmin } from './VinculosAdmin';

type Aba = 'usuarios' | 'avaliacoes' | 'vinculos';

const ABAS: { valor: Aba; nome: string }[] = [
  { valor: 'usuarios', nome: 'Usuários' },
  { valor: 'avaliacoes', nome: 'Avaliações' },
  { valor: 'vinculos', nome: 'Vínculos' },
];

const PAINEIS = { usuarios: UsuariosAdmin, avaliacoes: AvaliacoesAdmin, vinculos: VinculosAdmin } satisfies Record<Aba, () => unknown>;

export function Admin() {
  const [aba, setAba] = useState<Aba>('usuarios');
  const Painel = PAINEIS[aba];
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <h1 className="text-[28px] font-bold text-texto-forte">Administração</h1>
      <div role="tablist" aria-label="Moderação" className="flex gap-1 border-b border-borda">
        {ABAS.map((a) => (
          <button
            key={a.valor}
            type="button"
            role="tab"
            id={`aba-${a.valor}`}
            aria-selected={aba === a.valor}
            aria-controls={`painel-${a.valor}`}
            onClick={() => setAba(a.valor)}
            className={`-mb-px min-h-11 border-b-2 px-4 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-marca-texto ${
              aba === a.valor ? 'border-marca text-texto-forte' : 'border-transparent text-texto-suave hover:text-texto-forte'
            }`}
          >
            {a.nome}
          </button>
        ))}
      </div>
      <section role="tabpanel" id={`painel-${aba}`} aria-labelledby={`aba-${aba}`} className="flex flex-col gap-4">
        <Painel />
      </section>
    </main>
  );
}
