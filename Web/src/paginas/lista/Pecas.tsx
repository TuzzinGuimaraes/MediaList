// Peças das linhas e do cartão de destaque: nota, Progresso/horas e o ponto do Status.
import type { EstadoConsumo } from '@dominio/estadoConsumo';
import { totalDoItem } from '@dominio/itemLista';

import { Icone } from '../../componentes/Icone';
import { COR_DO_ESTADO } from '../../componentes/status';
import type { ItemLista } from './api';
import { formatarNumero, textos, UNIDADE } from './textos';

export function Nota({ nota, tamanho = 13 }: { nota: number | null; tamanho?: number }) {
  if (nota == null)
    return (
      <span aria-hidden className="text-texto-suave/60">
        —
      </span>
    );
  return (
    <span
      role="img"
      aria-label={textos.notaPessoal(formatarNumero(nota))}
      className="inline-flex items-center gap-1 font-semibold tabular-nums text-nota"
      style={{ fontSize: tamanho }}
    >
      <Icone nome="estrela" tamanho={tamanho - 2} cheio /> <span aria-hidden>{formatarNumero(nota)}</span>
    </span>
  );
}

/** "148 h" com o "h" menor (as horas legíveis); "12/24 ep" com o total suave. */
export function Consumo({ item, tamanho = 14 }: { item: ItemLista; tamanho?: number }) {
  if (item.tipo === 'jogo') {
    if (!item.progresso_atual)
      return (
        <span className="text-texto-suave/60" style={{ fontSize: tamanho * 0.85 }}>
          — h
        </span>
      );
    const horas = formatarNumero(item.progresso_atual);
    return (
      <span
        role="img"
        aria-label={textos.horasJogadas(horas)}
        className="font-bold tabular-nums leading-none text-texto-forte"
        style={{ fontSize: tamanho }}
      >
        <span aria-hidden>
          {horas}
          <span className="ml-0.5 font-semibold text-texto-suave" style={{ fontSize: tamanho * 0.7 }}>
            h
          </span>
        </span>
      </span>
    );
  }
  const total = totalDoItem(item);
  return (
    <span className="font-semibold tabular-nums leading-none text-texto-forte" style={{ fontSize: tamanho }}>
      {item.progresso_atual ?? 0}
      <span className="font-normal text-texto-suave">{total !== null ? `/${total}` : ''}</span>
      <span className="ml-1 font-normal text-texto-suave" style={{ fontSize: tamanho * 0.78 }}>
        {UNIDADE[item.tipo]}
      </span>
    </span>
  );
}

export function PontoStatus({ estado, tamanho = 8 }: { estado: EstadoConsumo; tamanho?: number }) {
  return <span aria-hidden className="shrink-0 rounded-full" style={{ width: tamanho, height: tamanho, background: COR_DO_ESTADO[estado] }} />;
}
