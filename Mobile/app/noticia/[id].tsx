// Uma Notícia: o destino da Notificação de Notícia (e, no ticket 03, do toque no push).
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useNoticia } from '@/api/noticias';
import { useSessao } from '@/auth/SessaoContext';
import { CartaoNoticia } from '@/components/CartaoNoticia';
import { Carregando, Falha } from '@/components/EstadoTela';
import { Voltar } from '@/components/TopoDetalhe';

/** Fora das abas, a tela precisa do próprio guard: um deep link pode abrir sem sessão. */
export default function TelaNoticia() {
  const { sessao } = useSessao();
  if (sessao.estado === 'carregando') return <Carregando />;
  if (sessao.estado === 'anonima') return <Redirect href="/login" />;
  if (sessao.estado === 'troca_de_senha') return <Redirect href="/definir-senha" />;
  return <Noticia />;
}

function Noticia() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const noticia = useNoticia(id);
  const voltar = () => (router.canGoBack() ? router.back() : router.replace('/noticias'));

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-fundo">
      <Voltar aoVoltar={voltar} />
      {noticia.data ? (
        <ScrollView contentContainerClassName="p-4">
          <CartaoNoticia noticia={noticia.data} />
        </ScrollView>
      ) : noticia.isError ? (
        <Falha erro={noticia.error} tentarDeNovo={() => noticia.refetch()} />
      ) : (
        <Carregando />
      )}
    </SafeAreaView>
  );
}
