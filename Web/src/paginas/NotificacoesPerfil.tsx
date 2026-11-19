// Notificações do Usuário (Atualizações das Mídias da Lista): as 50 mais recentes e
// "Marcar todas como lidas". No web antigo ficavam num sino da nav; aqui, no Perfil.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { formatarData } from '@dominio/datas';

import { exigir } from '../api/cliente';
import { mensagemDeErro } from '../api/erros';
import { Botao } from '../componentes/Botao';
import { Carregando, ErroTela } from '../componentes/Estados';
import { useApi } from '../sessao/SessaoContext';

export function NotificacoesPerfil() {
  const api = useApi();
  const queryClient = useQueryClient();
  const consulta = useQuery({
    queryKey: ['notificacoes'],
    queryFn: () => exigir(api.GET('/api/notificacoes')),
  });
  const marcar = useMutation({
    mutationFn: () => exigir(api.PUT('/api/notificacoes/marcar-todas-lidas')),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notificacoes'] }),
  });

  if (!consulta.data) {
    return consulta.isError ? (
      <ErroTela erro={consulta.error} tentarDeNovo={() => void consulta.refetch()} />
    ) : (
      <Carregando rotulo="Carregando notificações" />
    );
  }
  const { notificacoes } = consulta.data;
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
        {notificacoes.map((n, i) => {
          const data = formatarData(n.data_criacao);
          return (
            <li
              key={`${n.id_midia}-${n.data_criacao}-${i}`}
              aria-label={n.titulo}
              className={`flex gap-3 rounded-lg p-3 ${n.lida ? '' : 'bg-superficie-alta'}`}
            >
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
        })}
      </ul>
    </div>
  );
}
