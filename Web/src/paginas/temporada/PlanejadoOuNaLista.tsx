import type { TipoMidia } from '@dominio/estadoConsumo';

import { mensagemDeErro } from '../../api/erros';
import { Botao } from '../../componentes/Botao';
import { Icone } from '../../componentes/Icone';
import { useAdicionarComoPlanejado } from '../lista/api';

type Props = {
  idMidia: string;
  tipo: TipoMidia;
  titulo: string;
  /** Se a Mídia já está na Lista pessoal. */
  naLista: boolean;
  /** Pequeno, ao lado do episódio no Calendário; sem isso, ocupa a largura do cartão da Temporada. */
  compacto?: boolean;
  className?: string;
};

/** "Na Lista" para quem já tem o Item; senão, o botão "Planejado", que põe na Lista num toque. */
export function PlanejadoOuNaLista({ idMidia, tipo, titulo, naLista, compacto = false, className = '' }: Props) {
  const planejar = useAdicionarComoPlanejado();
  const aoPlanejar = () => planejar.mutate({ idMidia, tipo });
  const rotulo = `Pôr ${titulo} em Planejado`;
  return (
    <div className={`flex shrink-0 flex-col gap-1 ${className}`}>
      {naLista ? (
        <span className={`inline-flex items-center font-semibold text-texto-suave ${compacto ? 'min-h-8 text-[12px]' : 'min-h-11 text-[13px]'}`}>
          Na Lista
        </span>
      ) : compacto ? (
        <button
          type="button"
          aria-label={rotulo}
          disabled={planejar.isPending}
          onClick={aoPlanejar}
          className="inline-flex min-h-8 w-fit items-center gap-1 rounded-md border border-borda px-2 text-[12px] font-bold text-texto-forte outline-none hover:bg-superficie-alta focus-visible:ring-2 focus-visible:ring-marca-texto disabled:opacity-60"
        >
          <Icone nome="mais" tamanho={12} /> Planejado
        </button>
      ) : (
        <Botao
          variante="secundario"
          className="w-full"
          aria-label={rotulo}
          carregando={planejar.isPending}
          onClick={aoPlanejar}
          icone={<Icone nome="mais" tamanho={14} />}
        >
          Planejado
        </Botao>
      )}
      {planejar.isError ? (
        <p role="alert" className="text-[12px] text-erro">
          {mensagemDeErro(planejar.error)}
        </p>
      ) : null}
    </div>
  );
}
