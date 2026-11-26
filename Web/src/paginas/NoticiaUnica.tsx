// Uma Notícia sozinha: o destino do link da Notificação de Notícia.
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';

import { chaves } from '../api/chaves';
import { exigir } from '../api/cliente';
import { Carregando, ErroTela } from '../componentes/Estados';
import { useApi } from '../sessao/SessaoContext';
import { CartaoNoticia } from './Noticias';

export function NoticiaUnica() {
  const api = useApi();
  const { id } = useParams({ from: '/autenticado/noticias/$id' });
  const consulta = useQuery({
    queryKey: chaves.noticias.uma(id),
    queryFn: () => exigir(api.GET('/api/noticias/{id_noticia}', { params: { path: { id_noticia: id } } })),
  });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <Link to="/noticias" className="self-start text-[14px] font-semibold text-marca-texto hover:underline">
        Todas as Notícias
      </Link>
      {consulta.data ? (
        <CartaoNoticia noticia={consulta.data} />
      ) : consulta.isError ? (
        <ErroTela erro={consulta.error} />
      ) : (
        <Carregando rotulo="Carregando notícia" />
      )}
    </main>
  );
}
