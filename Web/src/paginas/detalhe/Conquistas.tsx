// Conquistas da Steam no Detalhe do jogo (spec `conquistas-steam`, ticket 02): no bloco do Item, o
// "34/50 conquistas" abre um modal com a lista completa (a API já manda na ordem e sem o spoiler da
// oculta); com 100% fora de Platinado, o destaque "Você tem todas as conquistas" com "Marcar
// Platinado", que grava pela mesma escrita do Status da Lista (nunca automático, ADR 0015). Cada
// obtida da lista tem "Destacar no Perfil" / "Tirar do Perfil" (ticket 03).
import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';

import {
  descricaoAcessivel,
  eLimiteDeDestaques,
  eRara,
  nomeDaConquista,
  sugereMarcarPlatinado,
  TEXTOS_DAS_CONQUISTAS,
  textoDaObtencao,
  textoDaRaridade,
  textoDoResumo,
} from '@dominio/conquistas';
import { rotuloPara } from '@dominio/estadoConsumo';

import { chaves } from '../../api/chaves';
import { mensagemDeErro } from '../../api/erros';
import type { Esquemas } from '../../api/tipos';
import { Botao } from '../../componentes/Botao';
import { Modal } from '../../componentes/Camada';
import { Carregando, FalhaParcial, Vazio } from '../../componentes/Estados';
import { Icone } from '../../componentes/Icone';
import { Selo } from '../../componentes/Selo';
import { useMudarStatus } from '../lista/api';
import { useConquistasDoItem, useMudarDestaque } from './consultas';

type Item = Esquemas['ItemLista'];
type Conquista = Esquemas['ConquistaDoItem'];

/** O "34/50 conquistas" do bloco do Item, que abre a lista; nada no jogo sem dado. */
export function ResumoDasConquistas({ item, jogo }: { item: Item | null | undefined; jogo: string }) {
  const [aberto, setAberto] = useState(false);
  const texto = textoDoResumo(item?.conquistas);
  if (!item || !texto) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex items-center justify-between gap-3 rounded-lg border border-borda bg-superficie px-4 py-2.5 text-[14px] font-semibold text-texto-forte outline-none hover:bg-superficie-alta focus-visible:ring-2 focus-visible:ring-marca-texto"
      >
        {texto}
        <Icone nome="direita" tamanho={16} className="text-texto-suave" />
      </button>
      <Modal titulo={TEXTOS_DAS_CONQUISTAS.titulo} aberto={aberto} fechar={() => setAberto(false)}>
        <ListaDeConquistas idLista={item.id_lista} jogo={jogo} />
      </Modal>
    </>
  );
}

function ListaDeConquistas({ idLista, jogo }: { idLista: string; jogo: string }) {
  const conquistas = useConquistasDoItem(idLista);
  if (conquistas.isError) return <FalhaParcial erro={conquistas.error} tentarDeNovo={() => void conquistas.refetch()} />;
  if (!conquistas.data) return <Carregando />;
  if (!conquistas.data.length) return <Vazio texto={TEXTOS_DAS_CONQUISTAS.vazia} />;
  return (
    <ul className="flex flex-col divide-y divide-borda">
      {conquistas.data.map((c) => (
        <LinhaDaConquista
          key={c.codigo}
          conquista={c}
          jogo={jogo}
          acao={c.obtida ? <BotaoDeDestaque idLista={idLista} conquista={c} /> : undefined}
        />
      ))}
    </ul>
  );
}

/** Uma conquista: ícone, nome, descrição, data e raridade. `acao` é o lugar do botão da linha (o destaque no Perfil). */
export function LinhaDaConquista({ conquista, jogo, acao }: { conquista: Conquista; jogo: string; acao?: ReactNode }) {
  const obtencao = textoDaObtencao(conquista);
  const raridade = textoDaRaridade(conquista.raridade);
  return (
    <li aria-label={descricaoAcessivel(conquista, jogo)} className="flex items-start gap-3 py-3">
      <span className="h-12 w-12 shrink-0 overflow-hidden rounded bg-superficie-alta">
        {conquista.icone ? (
          <img
            src={conquista.icone}
            alt=""
            loading="lazy"
            className={`h-full w-full object-cover ${conquista.obtida ? '' : 'opacity-60'}`}
          />
        ) : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className={`font-semibold ${conquista.obtida ? 'text-texto-forte' : 'text-texto-suave'}`}>
            {nomeDaConquista(conquista)}
          </span>
          {eRara(conquista.raridade) ? <Selo texto={TEXTOS_DAS_CONQUISTAS.rara} tom="marca" /> : null}
        </span>
        {conquista.descricao ? <span className="text-[14px] text-texto">{conquista.descricao}</span> : null}
        <span className="flex flex-wrap gap-x-3 text-[12px] text-texto-suave">
          {obtencao ? <span>{obtencao}</span> : null}
          {raridade ? <span>{raridade}</span> : null}
        </span>
      </span>
      {acao}
    </li>
  );
}

/** "Destacar no Perfil" / "Tirar do Perfil" na obtida, com o aviso quando o Perfil já tem os 6. */
function BotaoDeDestaque({ idLista, conquista }: { idLista: string; conquista: Conquista }) {
  const destaque = useMudarDestaque(idLista);
  const falha = destaque.isError
    ? eLimiteDeDestaques(destaque.error)
      ? TEXTOS_DAS_CONQUISTAS.limiteDeDestaques
      : mensagemDeErro(destaque.error)
    : null;
  return (
    <span className="flex max-w-48 shrink-0 flex-col items-end gap-1">
      <Botao
        variante="secundario"
        carregando={destaque.isPending}
        onClick={() => destaque.mutate({ conquista, destacar: !conquista.destacada })}
      >
        {conquista.destacada ? TEXTOS_DAS_CONQUISTAS.tirar : TEXTOS_DAS_CONQUISTAS.destacar}
      </Botao>
      {falha ? (
        <span role="alert" className="text-right text-[12px] text-erro">
          {falha}
        </span>
      ) : null}
    </span>
  );
}

/** "Você tem todas as conquistas" com "Marcar Platinado", junto do bloco do Item. */
export function DestaqueDePlatinado({ item }: { item: Item | null | undefined }) {
  const queryClient = useQueryClient();
  const status = useMudarStatus();
  const platinado = rotuloPara('platinado', 'jogo');
  const falha = status.isError ? (
    <p role="alert" className="text-[14px] text-erro">
      {mensagemDeErro(status.error)}
    </p>
  ) : null;
  if (!item || !platinado || !sugereMarcarPlatinado(item)) return falha;
  const marcar = () =>
    status.mutate(
      { item, rotulo: platinado },
      { onSuccess: () => void queryClient.invalidateQueries({ queryKey: chaves.conquistas.doItem(item.id_lista) }) },
    );
  return (
    <section
      aria-labelledby="titulo-destaque-platinado"
      className="flex flex-col gap-2 rounded-lg border border-marca/40 bg-superficie px-4 py-3"
    >
      <h2 id="titulo-destaque-platinado" className="font-semibold text-texto-forte">
        {TEXTOS_DAS_CONQUISTAS.todas}
      </h2>
      <Botao onClick={marcar} carregando={status.isPending}>
        {TEXTOS_DAS_CONQUISTAS.marcarPlatinado}
      </Botao>
      {falha}
    </section>
  );
}
