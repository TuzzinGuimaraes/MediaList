// Editar e Excluir de uma Notícia, só para o admin (Q130): no card da lista e na página da Notícia.
// Editar abre o formulário da Nova notícia preenchido; Excluir pede confirmação e apaga de vez.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { chaves } from '../api/chaves';
import { exigir } from '../api/cliente';
import { mensagemDeErro } from '../api/erros';
import type { Esquemas } from '../api/tipos';
import { Botao } from '../componentes/Botao';
import { Modal } from '../componentes/Camada';
import { useApi } from '../sessao/SessaoContext';
import { NovaNoticia } from './NovaNoticia';

type Props = {
  noticia: Esquemas['Noticia'];
  /** Depois de excluir (a página da Notícia volta para a lista). */
  excluida?(): Promise<unknown> | void;
};

export function AcoesNoticia({ noticia, excluida }: Props) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const id = noticia.id_noticia;

  const excluir = useMutation({
    mutationFn: () => exigir(api.DELETE('/api/noticias/{id_noticia}', { params: { path: { id_noticia: id } } })),
    onSuccess: async () => {
      // A própria Notícia não é recarregada: já não existe, e a tela dela está saindo.
      const uma = chaves.noticias.uma(id);
      const ehEla = (chave: readonly unknown[]) => uma.every((parte, i) => chave[i] === parte);
      await queryClient.invalidateQueries({ queryKey: chaves.noticias.todas, predicate: (q) => !ehEla(q.queryKey) });
      // As Notificações dela sumiram do sino.
      await queryClient.invalidateQueries({ queryKey: chaves.notificacoes });
      setExcluindo(false);
      await excluida?.();
      queryClient.removeQueries({ queryKey: uma });
    },
  });

  const fecharExclusao = () => {
    if (excluir.isPending) return;
    excluir.reset();
    setExcluindo(false);
  };

  return (
    <>
      <div className="flex gap-1 self-end">
        <Botao variante="fantasma" onClick={() => setEditando(true)}>
          Editar
        </Botao>
        <Botao variante="fantasma" onClick={() => setExcluindo(true)}>
          Excluir
        </Botao>
      </div>
      <NovaNoticia noticia={noticia} aberto={editando} fechar={() => setEditando(false)} publicada={() => setEditando(false)} />
      <Modal
        titulo="Excluir notícia"
        aberto={excluindo}
        fechar={fecharExclusao}
        rodape={
          <>
            <Botao variante="secundario" onClick={fecharExclusao} disabled={excluir.isPending}>
              Cancelar
            </Botao>
            <Botao carregando={excluir.isPending} onClick={() => excluir.mutate()}>
              Excluir
            </Botao>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-texto">
            Excluir a Notícia “{noticia.titulo}”? Ela some para todos, junto com as notificações. Não dá para desfazer.
          </p>
          {excluir.isError ? (
            <p role="alert" className="rounded-md border border-erro/40 bg-erro/10 p-3 text-[14px] text-erro">
              {mensagemDeErro(excluir.error)}
            </p>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
