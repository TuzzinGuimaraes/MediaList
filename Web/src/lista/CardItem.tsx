// Card compacto do Item na Lista (Resolution do 19 e do 34): banner esmaecido ao fundo,
// pôster pequeno, título, Status, Nota pessoal e o stepper, com o fio de progresso na base.
import { Link } from '@tanstack/react-router';

import { nomeDoTipo } from '@dominio/estadoConsumo';
import { passoDeProgresso, proporcaoDoFio, temProgresso, totalDoItem } from '@dominio/itemLista';
import { tituloDaMidia } from '@dominio/midia';

import { FioProgresso } from '../componentes/FioProgresso';
import { Icone } from '../componentes/Icone';
import { Monograma } from '../componentes/Monograma';
import { Selo, SeloStatus } from '../componentes/Selo';
import type { ItemLista } from './api';

/** O que a Lista faz com um Item: abrir o editor e dar um passo no Progresso. */
export type AcoesDoItem = {
  editar(item: ItemLista): void;
  passo(item: ItemLista, passo: 1 | -1): void;
};

function BotaoPasso({ rotulo, icone, desativado, aoClicar }: { rotulo: string; icone: 'mais' | 'menos'; desativado: boolean; aoClicar(): void }) {
  return (
    <button
      type="button"
      aria-label={rotulo}
      disabled={desativado}
      onClick={aoClicar}
      className="flex h-8 w-8 items-center justify-center rounded-full text-texto-forte outline-none hover:bg-superficie focus-visible:ring-2 focus-visible:ring-marca-texto disabled:text-borda"
    >
      <Icone nome={icone} tamanho={16} />
    </button>
  );
}

/** Pílula `− 3/12 +`; as horas de jogo não têm stepper (editadas no editor). */
function Stepper({ item, titulo, passo }: { item: ItemLista; titulo: string; passo(p: 1 | -1): void }) {
  const total = totalDoItem(item);
  const atual = item.progresso_atual ?? 0;
  return (
    <div className="flex items-center rounded-full border border-borda bg-superficie-alta">
      <BotaoPasso rotulo={`Menos um em ${titulo}`} icone="menos" desativado={passoDeProgresso(item, -1) === null} aoClicar={() => passo(-1)} />
      <span
        aria-label={total !== null ? `Progresso: ${atual} de ${total}` : `Progresso: ${atual}`}
        className="min-w-12 text-center text-[13px] font-semibold tabular-nums text-texto-forte"
      >
        {total !== null ? `${atual}/${total}` : atual}
      </span>
      <BotaoPasso rotulo={`Mais um em ${titulo}`} icone="mais" desativado={passoDeProgresso(item, 1) === null} aoClicar={() => passo(1)} />
    </div>
  );
}

type Props = {
  item: ItemLista;
  acoes: AcoesDoItem;
  /** Selo do Status: na busca, que junta todos os Status. */
  comStatus?: boolean;
};

export function CardItem({ item, acoes, comStatus = false }: Props) {
  const titulo = tituloDaMidia(item);
  const fundo = item.banner_url ?? item.poster_url;
  return (
    <article
      aria-label={titulo}
      className="group relative flex h-[104px] overflow-hidden rounded-md bg-superficie transition hover:ring-1 hover:ring-borda"
    >
      {fundo ? (
        <img
          src={fundo}
          alt=""
          loading="lazy"
          className={`absolute inset-0 h-full w-full object-cover opacity-25 ${item.banner_url ? '' : 'blur-md'}`}
        />
      ) : null}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-superficie via-superficie/90 to-superficie/70" />
      <Link
        to="/midia/$id"
        params={{ id: item.id_midia }}
        aria-label={`Abrir ${titulo}`}
        className="relative m-2 aspect-[2/3] shrink-0 overflow-hidden rounded bg-superficie-alta outline-none focus-visible:ring-2 focus-visible:ring-marca-texto"
      >
        {item.poster_url ? (
          <img src={item.poster_url} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center">
            <Monograma tamanho={24} rotulo={null} />
          </span>
        )}
      </Link>
      <button
        type="button"
        aria-label={`Editar ${titulo}`}
        onClick={() => acoes.editar(item)}
        className="relative flex min-w-0 flex-1 flex-col items-start gap-1 py-2 pr-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-marca-texto"
      >
        <span className="line-clamp-2 text-[14px] font-semibold leading-tight text-texto-forte group-hover:underline">
          {titulo}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
          <Selo texto={nomeDoTipo(item.tipo)} />
          {comStatus ? <SeloStatus rotulo={item.status_consumo} tipo={item.tipo} /> : null}
          {item.nota_usuario != null ? (
            <span aria-label={`Nota pessoal: ${item.nota_usuario}`} className="inline-flex items-center gap-1 font-bold text-nota">
              <Icone nome="estrela" tamanho={12} cheio /> {item.nota_usuario}
            </span>
          ) : null}
          {item.favorito ? (
            <span role="img" aria-label="Favorito" className="text-marca-texto">
              <Icone nome="coracao" tamanho={12} cheio />
            </span>
          ) : null}
        </span>
      </button>
      <div className="absolute bottom-2 right-2">
        {temProgresso(item.tipo) ? (
          <Stepper item={item} titulo={titulo} passo={(p) => acoes.passo(item, p)} />
        ) : (
          <span className="text-[12px] text-texto-suave">{`${item.progresso_atual ?? 0} h`}</span>
        )}
      </div>
      <FioProgresso proporcao={proporcaoDoFio(item)} />
    </article>
  );
}
