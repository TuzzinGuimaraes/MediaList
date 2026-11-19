import { Link } from '@tanstack/react-router';

import { Vazio } from '../componentes/Estados';

export function NaoEncontrada() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 p-6 text-center">
      <h1 className="text-[28px] font-bold text-texto-forte">Página não encontrada</h1>
      <Vazio
        texto="O endereço não existe ou mudou."
        acao={
          <Link to="/" className="font-semibold text-marca-texto hover:underline">
            Voltar ao Início
          </Link>
        }
      />
    </main>
  );
}
