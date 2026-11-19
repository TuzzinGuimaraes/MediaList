// Aba Avaliações da Administração: as 50 mais recentes, com exclusão confirmada.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import { formatarData } from '@dominio/datas';
import { nomeDoTipo } from '@dominio/estadoConsumo';
import { tituloDaMidia } from '@dominio/midia';

import { chaves } from '../../api/chaves';
import { exigir } from '../../api/cliente';
import { mensagemDeErro } from '../../api/erros';
import type { Esquemas } from '../../api/tipos';
import { Botao } from '../../componentes/Botao';
import { Modal } from '../../componentes/Camada';
import { Carregando, ErroTela, Vazio } from '../../componentes/Estados';
import { useApi } from '../../sessao/SessaoContext';
import { Aviso } from './Aviso';

export function AvaliacoesAdmin() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [excluindo, setExcluindo] = useState<Esquemas['AvaliacaoModeracao'] | null>(null);

  const consulta = useQuery({
    queryKey: chaves.moderacao.avaliacoes,
    queryFn: () => exigir(api.GET('/api/moderacao/avaliacoes')),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => exigir(api.DELETE('/api/avaliacoes/{avaliacao_id}', { params: { path: { avaliacao_id: id } } })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: chaves.moderacao.avaliacoes });
      setExcluindo(null);
    },
  });

  if (!consulta.data) {
    return consulta.isError ? (
      <ErroTela erro={consulta.error} tentarDeNovo={() => void consulta.refetch()} />
    ) : (
      <Carregando rotulo="Carregando Avaliações" />
    );
  }
  const { avaliacoes } = consulta.data;
  if (!avaliacoes.length) return <Vazio texto="Nenhuma Avaliação para moderar." />;

  const fechar = () => {
    if (excluir.isPending) return;
    excluir.reset();
    setExcluindo(null);
  };

  return (
    <>
      <p className="text-[14px] text-texto-suave">As 50 Avaliações mais recentes.</p>
      <ul className="flex flex-col gap-2">
        {avaliacoes.map((a) => {
          const titulo = a.titulo_avaliacao || 'Sem título';
          const data = formatarData(a.data_avaliacao);
          return (
            <li key={a.id_avaliacao} aria-label={titulo} className="flex flex-col gap-2 rounded-lg bg-superficie px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-bold text-texto-forte">{titulo}</span>
                  <span className="text-[13px] text-texto-suave">
                    Por {a.nome_completo} ·{' '}
                    <Link to="/midia/$id" params={{ id: a.id_midia }} className="font-semibold text-marca-texto hover:underline">
                      {tituloDaMidia(a)}
                    </Link>{' '}
                    · {nomeDoTipo(a.tipo)} · Nota <span className="font-semibold text-texto">{a.nota}</span>
                    {data ? ` · ${data}` : ''}
                  </span>
                </div>
                <Botao variante="secundario" onClick={() => setExcluindo(a)}>
                  Excluir
                </Botao>
              </div>
              {a.texto_avaliacao ? <p className="whitespace-pre-line text-[14px] text-texto">{a.texto_avaliacao}</p> : null}
            </li>
          );
        })}
      </ul>
      <Modal
        titulo="Excluir Avaliação"
        aberto={excluindo !== null}
        fechar={fechar}
        rodape={
          <>
            <Botao variante="secundario" onClick={fechar} disabled={excluir.isPending}>
              Cancelar
            </Botao>
            <Botao carregando={excluir.isPending} onClick={() => excluindo && excluir.mutate(excluindo.id_avaliacao)}>
              Excluir
            </Botao>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-texto">
            Excluir a Avaliação “{excluindo?.titulo_avaliacao || 'Sem título'}” de {excluindo?.nome_completo}? Não dá para
            desfazer.
          </p>
          <Aviso texto={excluir.isError ? mensagemDeErro(excluir.error) : null} />
        </div>
      </Modal>
    </>
  );
}
