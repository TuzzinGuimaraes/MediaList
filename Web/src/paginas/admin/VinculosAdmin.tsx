// Aba Vínculos da Administração (Q116): os vínculos que os Usuários fizeram de um Não encontrado
// a uma Mídia, 20 por página, com Desfazer confirmado. Desfazer não apaga Itens: só faz a próxima
// importação voltar a dar Não encontrado.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import { formatarData } from '@dominio/datas';
import { nomeDoTipo } from '@dominio/estadoConsumo';
import { ROTULO_DA_PLATAFORMA } from '@dominio/integracoes';
import { tituloDaMidia } from '@dominio/midia';

import { chaves } from '../../api/chaves';
import { exigir } from '../../api/cliente';
import { mensagemDeErro } from '../../api/erros';
import { paginacao } from '../../api/paginacao';
import type { Esquemas } from '../../api/tipos';
import { Botao } from '../../componentes/Botao';
import { Modal } from '../../componentes/Camada';
import { Carregando, ErroTela, Vazio } from '../../componentes/Estados';
import { Paginacao } from '../../componentes/Paginacao';
import { useApi } from '../../sessao/SessaoContext';
import { Aviso } from './Aviso';

const VINCULOS_POR_PAGINA = 20;

type Vinculo = Esquemas['VinculoAdmin'];

export function VinculosAdmin() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [pagina, setPagina] = useState(1);
  const [desfazendo, setDesfazendo] = useState<Vinculo | null>(null);

  const consulta = useQuery({
    queryKey: chaves.moderacao.vinculosDaPagina(pagina),
    queryFn: () => exigir(api.GET('/api/admin/vinculos', { params: { query: { pagina, por_pagina: VINCULOS_POR_PAGINA } } })),
    placeholderData: keepPreviousData,
  });

  const desfazer = useMutation({
    mutationFn: (id: string) => exigir(api.DELETE('/api/admin/vinculos/{id_vinculo}', { params: { path: { id_vinculo: id } } })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: chaves.moderacao.vinculos });
      setDesfazendo(null);
    },
  });

  if (!consulta.data) {
    return consulta.isError ? (
      <ErroTela erro={consulta.error} tentarDeNovo={() => void consulta.refetch()} />
    ) : (
      <Carregando rotulo="Carregando vínculos" />
    );
  }
  if (!consulta.data.itens.length) return <Vazio texto="Nenhum vínculo feito por Usuários." />;

  const fechar = () => {
    if (desfazer.isPending) return;
    desfazer.reset();
    setDesfazendo(null);
  };

  return (
    <>
      <p className="text-[14px] text-texto-suave">
        Não encontrados que os Usuários ligaram a uma Mídia do Catálogo. O vínculo vale para todos.
      </p>
      <ul className="flex flex-col gap-2">
        {consulta.data.itens.map((v) => {
          const titulo = tituloDaMidia(v);
          const origem = `${ROTULO_DA_PLATAFORMA[v.plataforma]} ${v.origem_id}`;
          const data = formatarData(v.criado_em);
          return (
            <li
              key={v.id_vinculo}
              aria-label={titulo}
              className="flex items-start justify-between gap-4 rounded-lg bg-superficie px-5 py-4"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-texto-forte">
                  {v.link ? (
                    <a href={v.link} target="_blank" rel="noopener noreferrer" className="font-semibold text-marca-texto hover:underline">
                      {origem}
                    </a>
                  ) : (
                    <span className="font-semibold">{origem}</span>
                  )}{' '}
                  →{' '}
                  <Link to="/midia/$id" params={{ id: v.id_midia }} className="font-bold text-marca-texto hover:underline">
                    {titulo}
                  </Link>
                </span>
                <span className="text-[13px] text-texto-suave">
                  {nomeDoTipo(v.tipo)} · Por {v.nome_completo ?? 'conta apagada'}
                  {data ? ` · ${data}` : ''}
                </span>
              </div>
              <Botao variante="secundario" onClick={() => setDesfazendo(v)}>
                Desfazer
              </Botao>
            </li>
          );
        })}
      </ul>
      <Paginacao paginacao={paginacao(consulta.data)} ir={setPagina} />
      <Modal
        titulo="Desfazer vínculo"
        aberto={desfazendo !== null}
        fechar={fechar}
        rodape={
          <>
            <Botao variante="secundario" onClick={fechar} disabled={desfazer.isPending}>
              Cancelar
            </Botao>
            <Botao carregando={desfazer.isPending} onClick={() => desfazendo && desfazer.mutate(desfazendo.id_vinculo)}>
              Desfazer
            </Botao>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-texto">
            Desfazer o vínculo de {desfazendo ? `${ROTULO_DA_PLATAFORMA[desfazendo.plataforma]} ${desfazendo.origem_id}` : ''} com “
            {desfazendo ? tituloDaMidia(desfazendo) : ''}”? Os Itens já gravados ficam; a próxima importação volta a dar Não
            encontrado.
          </p>
          <Aviso texto={desfazer.isError ? mensagemDeErro(desfazer.error) : null} />
        </div>
      </Modal>
    </>
  );
}
