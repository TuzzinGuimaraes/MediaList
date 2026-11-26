import { Link } from '@tanstack/react-router';

import { formatarData } from '@dominio/datas';

import type { Esquemas } from '../api/tipos';

/**
 * Uma Notificação: a Mídia (ou "Notícia") e a data, o título e a mensagem; a não lida ganha
 * fundo e o ponto da marca. A de Notícia é um link para a Notícia; `aoAbrir` roda no clique.
 */
export function ItemNotificacao({ notificacao: n, aoAbrir }: { notificacao: Esquemas['Notificacao']; aoAbrir?(): void }) {
  const data = formatarData(n.data_criacao);
  const conteudo = (
    <>
      <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.lida ? '' : 'bg-marca'}`} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[12px] text-texto-suave">
          {n.origem === 'noticia' ? 'Notícia' : n.midia_nome}
          {data ? ` · ${data}` : ''}
        </span>
        <span className="text-[14px] font-semibold text-texto-forte">{n.titulo}</span>
        <span className="text-[14px] text-texto">{n.mensagem}</span>
        {n.lida ? null : <span className="sr-only">Não lida</span>}
      </div>
    </>
  );
  const fundo = n.lida ? '' : 'bg-superficie-alta';
  return (
    <li aria-label={n.titulo} className={n.id_noticia ? '' : `flex gap-3 rounded-lg p-3 ${fundo}`}>
      {n.id_noticia ? (
        <Link
          to="/noticias/$id"
          params={{ id: n.id_noticia }}
          onClick={aoAbrir}
          className={`flex gap-3 rounded-lg p-3 outline-none hover:bg-superficie-alta focus-visible:ring-2 focus-visible:ring-marca-texto ${fundo}`}
        >
          {conteudo}
        </Link>
      ) : (
        conteudo
      )}
    </li>
  );
}
