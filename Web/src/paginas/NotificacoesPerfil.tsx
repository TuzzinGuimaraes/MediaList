// Notificações no Perfil: as 50 mais recentes e "Marcar todas como lidas". O sino da nav
// mostra as últimas e traz para cá.
import { mensagemDeErro } from '../api/erros';
import { Botao } from '../componentes/Botao';
import { Carregando, ErroTela } from '../componentes/Estados';
import { chaveDaNotificacao, useMarcarTodasLidas, useNotificacoes } from '../notificacoes/consultas';
import { ItemNotificacao } from '../notificacoes/ItemNotificacao';

export function NotificacoesPerfil() {
  const consulta = useNotificacoes();
  const marcar = useMarcarTodasLidas();

  if (!consulta.data) {
    return consulta.isError ? (
      <ErroTela erro={consulta.error} tentarDeNovo={() => void consulta.refetch()} />
    ) : (
      <Carregando rotulo="Carregando notificações" />
    );
  }
  const notificacoes = consulta.data;
  if (!notificacoes.length) return <p className="py-6 text-center text-texto-suave">Nenhuma notificação por aqui.</p>;

  return (
    <div className="flex flex-col gap-3">
      {notificacoes.some((n) => !n.lida) ? (
        <Botao variante="secundario" carregando={marcar.isPending} onClick={() => marcar.mutate()}>
          Marcar todas como lidas
        </Botao>
      ) : null}
      {marcar.isError ? (
        <p role="alert" className="text-[13px] text-erro">
          {mensagemDeErro(marcar.error)}
        </p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {notificacoes.map((n, i) => (
          <ItemNotificacao key={chaveDaNotificacao(n, i)} notificacao={n} />
        ))}
      </ul>
    </div>
  );
}
