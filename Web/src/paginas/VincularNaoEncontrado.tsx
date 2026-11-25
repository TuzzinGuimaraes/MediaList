// Vincular um Não encontrado (Q115/Q116): a busca do Catálogo (a mesma do Explorar, GET /midias?busca=)
// no Tipo do item; escolher a Mídia grava o vínculo para todos e já leva o Item para a Lista.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { nomeDoTipo, type TipoMidia } from '@dominio/estadoConsumo';
import { type NomePlataforma, tituloDoVincular } from '@dominio/integracoes';
import { tituloDaMidia } from '@dominio/midia';
import type { NaoEncontrado } from '@dominio/tipos';

import { chaves } from '../api/chaves';
import { exigir } from '../api/cliente';
import { mensagemDeErro } from '../api/erros';
import { Botao } from '../componentes/Botao';
import { Modal } from '../componentes/Camada';
import { Icone } from '../componentes/Icone';
import { useApi } from '../sessao/SessaoContext';
import { CampoAtrasado } from './explorar/CampoAtrasado';

const MINIMO_BUSCA = 2;
const POR_PAGINA = 10;

type Props = {
  plataforma: NomePlataforma;
  item: NaoEncontrado & { origem_id: string; tipo: TipoMidia };
  fechar(): void;
  aoVincular(): void;
};

export function VincularNaoEncontrado({ plataforma, item, fechar, aoVincular }: Props) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState('');
  const consulta = { busca, tipo: item.tipo, por_pagina: POR_PAGINA };
  const resultado = useQuery({
    queryKey: chaves.midias.explorar(consulta),
    queryFn: () => exigir(api.GET('/api/midias', { params: { query: consulta } })),
    enabled: busca.length >= MINIMO_BUSCA,
    placeholderData: keepPreviousData,
  });
  const vincular = useMutation({
    mutationFn: (id_midia: string) =>
      exigir(api.POST('/api/integracoes/vinculos', { body: { plataforma, origem_id: item.origem_id, id_midia } })),
    onSuccess: () => {
      for (const queryKey of [chaves.integracoes, chaves.lista.toda, ['usuario'], chaves.midias.todas]) {
        void queryClient.invalidateQueries({ queryKey });
      }
      aoVincular();
    },
  });

  const midias = busca.length >= MINIMO_BUSCA ? (resultado.data?.itens ?? []) : [];
  return (
    <Modal titulo={tituloDoVincular(item)} aberto fechar={() => !vincular.isPending && fechar()}>
      <div className="flex flex-col gap-4">
        <p className="text-[14px] text-texto-suave">
          Busque a obra no Catálogo (Tipo {nomeDoTipo(item.tipo)}). O vínculo vale para todos e o Item já entra na sua
          Lista.
        </p>
        <label className="flex items-center gap-2 rounded-md border border-borda bg-superficie-alta px-3 focus-within:border-marca-texto">
          <Icone nome="busca" tamanho={16} className="text-texto-suave" />
          <CampoAtrasado
            type="search"
            aria-label="Buscar no Catálogo"
            placeholder="Buscar por título"
            valor={busca}
            aceitar={(v) => v === '' || v.length >= MINIMO_BUSCA}
            mudar={setBusca}
            className="min-h-10 w-full bg-transparent text-[14px] text-texto-forte outline-none placeholder:text-texto-suave"
          />
        </label>
        {vincular.isError ? (
          <p role="alert" className="text-[13px] text-erro">
            {mensagemDeErro(vincular.error)}
          </p>
        ) : null}
        {resultado.isError ? (
          <p role="alert" className="text-[13px] text-erro">
            {mensagemDeErro(resultado.error)}
          </p>
        ) : busca.length >= MINIMO_BUSCA && resultado.data && !midias.length ? (
          <p className="text-[14px] text-texto-suave">Nada no Catálogo com esse título.</p>
        ) : null}
        <ul aria-label="Mídias do Catálogo" className="flex flex-col gap-2">
          {midias.map((m) => {
            const titulo = tituloDaMidia(m);
            const ano = m.data_lancamento?.slice(0, 4);
            return (
              <li key={m.id_midia} className="flex items-center justify-between gap-3 rounded-md bg-superficie-alta px-4 py-3">
                <span className="min-w-0 text-[14px] text-texto-forte">
                  {titulo}
                  {ano ? <span className="text-texto-suave"> · {ano}</span> : null}
                </span>
                <Botao
                  variante="secundario"
                  aria-label={`Vincular a ${titulo}`}
                  carregando={vincular.isPending && vincular.variables === m.id_midia}
                  disabled={vincular.isPending}
                  onClick={() => vincular.mutate(m.id_midia)}
                >
                  Escolher
                </Botao>
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}
