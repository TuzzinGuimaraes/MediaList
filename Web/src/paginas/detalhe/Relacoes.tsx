// Relações da Mídia (spec `relacoes`): o carrossel depois da Sinopse, com o "e mais N" dos jogos,
// e o destaque da Sequência no anime ou mangá Concluído. Nomes, ordem, corte dos jogos, sugestão
// e link da fonte vêm de `dominio/relacoes`.
import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import { CardA, CardAFora } from '../../componentes/Cards';
import { Modal } from '../../componentes/Camada';
import { FalhaParcial } from '../../componentes/Estados';
import { Fileira, TituloSecao } from '../../componentes/Fileira';
import { Monograma } from '../../componentes/Monograma';
import { SeloStatus } from '../../componentes/Selo';
import { nomeDoTipo } from '@dominio/estadoConsumo';
import {
  carrosselDeRelacoes,
  chaveDaRelacao,
  descricaoDaRelacao,
  destinoDaRelacao,
  type MidiaComRelacoes,
  nomeDaRelacao,
  ordenarRelacoes,
  sugestoesDeSequencia,
  TEXTOS_DAS_RELACOES,
} from '@dominio/relacoes';
import type { RelacaoDaMidia } from '@dominio/tipos';
import { PlanejadoOuNaLista } from '../temporada/PlanejadoOuNaLista';
import { useRelacoes } from './consultas';

const LARGURA = 140;

/** Card A da obra relacionada: a Relação na linha de baixo e o Status sobre o pôster. */
function CartaoDaRelacao({ relacao }: { relacao: RelacaoDaMidia }) {
  const conteudo = {
    titulo: relacao.titulo,
    posterUrl: relacao.poster_url,
    tipo: nomeDoTipo(relacao.tipo),
    notas: <span className="text-[12px] font-semibold text-texto-suave">{nomeDaRelacao(relacao)}</span>,
    selos: relacao.status_consumo ? <SeloStatus rotulo={relacao.status_consumo} tipo={relacao.tipo} sobreImagem /> : null,
    largura: LARGURA,
    rotulo: descricaoDaRelacao(relacao),
  };
  const destino = destinoDaRelacao(relacao);
  return destino?.abre === 'detalhe' ? (
    <CardA idMidia={destino.idMidia} {...conteudo} />
  ) : (
    <CardAFora link={destino?.link ?? null} {...conteudo} />
  );
}

/** A seção "Relações"; some sem nenhuma. */
export function Relacoes({ midia }: { midia: MidiaComRelacoes }) {
  const relacoes = useRelacoes(midia.id_midia);
  const [todas, setTodas] = useState(false);
  if (relacoes.isError && !relacoes.data) {
    return (
      <section aria-labelledby="titulo-relacoes">
        <TituloSecao>
          <span id="titulo-relacoes">{TEXTOS_DAS_RELACOES.secao}</span>
        </TituloSecao>
        <FalhaParcial erro={relacoes.error} tentarDeNovo={() => void relacoes.refetch()} />
      </section>
    );
  }
  const lista = relacoes.data ?? [];
  const { cartoes, mais } = carrosselDeRelacoes(lista, midia);
  const acao =
    mais > 0 ? (
      <button type="button" onClick={() => setTodas(true)} className="text-[14px] text-marca-texto hover:underline">
        {TEXTOS_DAS_RELACOES.mais(mais)}
      </button>
    ) : null;
  return (
    <>
      <Fileira titulo={TEXTOS_DAS_RELACOES.secao} vazia={!cartoes.length} acao={acao} recuo="">
        {cartoes.map((r) => (
          <CartaoDaRelacao key={chaveDaRelacao(r)} relacao={r} />
        ))}
      </Fileira>
      <Modal titulo={TEXTOS_DAS_RELACOES.listaCompleta} aberto={todas} fechar={() => setTodas(false)}>
        <div className="flex flex-wrap gap-3">
          {ordenarRelacoes(lista).map((r) => (
            <CartaoDaRelacao key={chaveDaRelacao(r)} relacao={r} />
          ))}
        </div>
      </Modal>
    </>
  );
}

/** O destaque do anime ou mangá Concluído: cada Sequência fora da Lista, com "Planejado" se está no Catálogo. */
export function SugestaoDeSequencia({ midia, item }: { midia: MidiaComRelacoes; item: { status_consumo: string } | null | undefined }) {
  const relacoes = useRelacoes(midia.id_midia);
  const sugestoes = sugestoesDeSequencia(midia, item, relacoes.data ?? []);
  if (!sugestoes.length) return null;
  return (
    <section
      aria-labelledby="titulo-sugestao-sequencia"
      className="flex flex-col gap-2 rounded-lg border border-marca/40 bg-superficie px-4 py-3"
    >
      <h2 id="titulo-sugestao-sequencia" className="font-semibold text-texto-forte">
        {TEXTOS_DAS_RELACOES.sugestao}
      </h2>
      <ul className="flex flex-col gap-2">
        {sugestoes.map(({ relacao, planejavel }) => (
          <li key={chaveDaRelacao(relacao)} className="flex items-center justify-between gap-4">
            <LinkDaSugestao relacao={relacao} />
            {planejavel && relacao.id_midia !== null ? (
              <PlanejadoOuNaLista
                idMidia={relacao.id_midia}
                tipo={relacao.tipo}
                titulo={relacao.titulo}
                naLista={false}
                compacto
              />
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function LinkDaSugestao({ relacao }: { relacao: RelacaoDaMidia }) {
  const corpo = (
    <>
      <span className="h-[60px] w-10 shrink-0 overflow-hidden rounded bg-superficie-alta">
        {relacao.poster_url ? (
          <img src={relacao.poster_url} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center">
            <Monograma tamanho={20} rotulo={null} />
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="line-clamp-2 font-semibold text-texto-forte">{relacao.titulo}</span>
        <span className="text-[12px] text-texto-suave">
          {nomeDaRelacao(relacao)} · {nomeDoTipo(relacao.tipo)}
        </span>
      </span>
    </>
  );
  const classe = 'flex min-w-0 items-center gap-3 rounded-md outline-none hover:underline focus-visible:ring-2 focus-visible:ring-marca-texto';
  const rotulo = descricaoDaRelacao(relacao);
  const destino = destinoDaRelacao(relacao);
  if (destino?.abre === 'detalhe') {
    return (
      <Link to="/midia/$id" params={{ id: destino.idMidia }} aria-label={rotulo} className={classe}>
        {corpo}
      </Link>
    );
  }
  return destino ? (
    <a href={destino.link} target="_blank" rel="noopener noreferrer" aria-label={rotulo} className={classe}>
      {corpo}
    </a>
  ) : (
    <span role="group" aria-label={rotulo} className={classe}>
      {corpo}
    </span>
  );
}
