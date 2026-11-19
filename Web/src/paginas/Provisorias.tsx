// Telas provisórias: cada uma é substituída pelo ticket indicado da spec web-novo.
import { Link } from '@tanstack/react-router';

import { Vazio } from '../componentes/Estados';

function EmConstrucao({ titulo, ticket }: { titulo: string; ticket: string }) {
  return (
    <div className="px-12 py-10">
      <h1 className="text-[28px] font-bold text-texto-forte">{titulo}</h1>
      <Vazio texto={`Em construção (ticket ${ticket}).`} />
    </div>
  );
}

export const Inicio = () => <EmConstrucao titulo="Início" ticket="04" />;
export const Explorar = () => <EmConstrucao titulo="Explorar" ticket="05" />;
export const Detalhe = () => <EmConstrucao titulo="Mídia" ticket="06" />;
export const Lista = () => <EmConstrucao titulo="Minha Lista" ticket="07" />;

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
