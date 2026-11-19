import { formatarData } from '@dominio/datas';

import type { Esquemas } from '../api/tipos';

/** Uma Notificação: a Mídia e a data, o título e a mensagem; a não lida ganha fundo e o ponto da marca. */
export function ItemNotificacao({ notificacao: n }: { notificacao: Esquemas['Notificacao'] }) {
  const data = formatarData(n.data_criacao);
  return (
    <li aria-label={n.titulo} className={`flex gap-3 rounded-lg p-3 ${n.lida ? '' : 'bg-superficie-alta'}`}>
      <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.lida ? '' : 'bg-marca'}`} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[12px] text-texto-suave">
          {n.midia_nome}
          {data ? ` · ${data}` : ''}
        </span>
        <span className="text-[14px] font-semibold text-texto-forte">{n.titulo}</span>
        <span className="text-[14px] text-texto">{n.mensagem}</span>
        {n.lida ? null : <span className="sr-only">Não lida</span>}
      </div>
    </li>
  );
}

