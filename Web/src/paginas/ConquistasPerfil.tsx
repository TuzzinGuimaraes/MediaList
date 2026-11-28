// "Conquistas em destaque" no Perfil (spec `conquistas-steam`, ticket 03): até 6 conquistas obtidas,
// já escolhidas e ordenadas pela API (as escolhidas, ou as mais raras com a dica), e o total. Sem
// nenhuma obtida, o Perfil não mostra a seção (`mostraDestaquesNoPerfil`). Destacar e tirar ficam na
// lista de conquistas do Detalhe.
import {
  descricaoDoDestaque,
  eRara,
  TEXTOS_DAS_CONQUISTAS,
  textoDaObtencao,
  textoDaRaridade,
  textoDoTotal,
} from '@dominio/conquistas';

import type { Esquemas } from '../api/tipos';
import { Selo } from '../componentes/Selo';

type Destaque = Esquemas['ConquistaEmDestaque'];

/** O conteúdo da seção "Conquistas em destaque": o total, a dica nos automáticos e os destaques. */
export function ConquistasEmDestaque({ resposta }: { resposta: Esquemas['RespostaDestaques'] }) {
  const { destaques, automaticos, total } = resposta;
  return (
    <>
      {/* O botão "Escolher destaques" (ticket 04) entra junto do total. */}
      <p className="text-[14px] text-texto-suave">{textoDoTotal(total)}</p>
      {automaticos ? <p className="text-[14px] text-texto">{TEXTOS_DAS_CONQUISTAS.dicaAutomaticos}</p> : null}
      <ul className="grid gap-3 sm:grid-cols-2">
        {destaques.map((d) => (
          <CartaoDoDestaque key={`${d.id_lista}/${d.codigo}`} destaque={d} />
        ))}
      </ul>
    </>
  );
}

function CartaoDoDestaque({ destaque }: { destaque: Destaque }) {
  const raridade = textoDaRaridade(destaque.raridade);
  const obtencao = textoDaObtencao({ obtida: true, obtida_em: destaque.obtida_em });
  return (
    <li aria-label={descricaoDoDestaque(destaque)} className="flex items-start gap-3 rounded-lg bg-superficie-alta p-3">
      <span className="h-12 w-12 shrink-0 overflow-hidden rounded bg-superficie">
        {destaque.icone ? <img src={destaque.icone} alt="" loading="lazy" className="h-full w-full object-cover" /> : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-texto-forte">{destaque.nome}</span>
          {eRara(destaque.raridade) ? <Selo texto={TEXTOS_DAS_CONQUISTAS.rara} tom="marca" /> : null}
        </span>
        <span className="truncate text-[14px] text-texto">{destaque.jogo}</span>
        <span className="flex flex-wrap gap-x-3 text-[12px] text-texto-suave">
          {obtencao ? <span>{obtencao}</span> : null}
          {raridade ? <span>{raridade}</span> : null}
        </span>
      </span>
    </li>
  );
}
