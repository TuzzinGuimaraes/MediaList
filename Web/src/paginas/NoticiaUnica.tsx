// Uma Notícia sozinha: o destino do link da Notificação de Notícia. O admin edita ou exclui daqui;
// excluída, volta para a lista.
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';

import { chaves } from '../api/chaves';
import { exigir } from '../api/cliente';
import { Carregando, ErroTela } from '../componentes/Estados';
import { ehAdmin } from '../sessao/sessao';
import { useApi, useUsuario } from '../sessao/SessaoContext';
import { AcoesNoticia } from './AcoesNoticia';
import { CartaoNoticia } from './Noticias';

export function NoticiaUnica() {
  const api = useApi();
  const admin = ehAdmin(useUsuario());
  const navigate = useNavigate();
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
        <CartaoNoticia
          noticia={consulta.data}
          acoes={admin ? <AcoesNoticia noticia={consulta.data} excluida={() => navigate({ to: '/noticias' })} /> : null}
        />
      ) : consulta.isError ? (
        <ErroTela erro={consulta.error} />
      ) : (
        <Carregando rotulo="Carregando notícia" />
      )}
    </main>
  );
}
