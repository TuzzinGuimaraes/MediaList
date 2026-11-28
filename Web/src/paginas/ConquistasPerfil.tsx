// "Conquistas em destaque" no Perfil (spec `conquistas-steam`, ticket 03): até 6 conquistas obtidas,
// já escolhidas e ordenadas pela API (as escolhidas, ou as mais raras com a dica), e o total. Sem
// nenhuma obtida, o Perfil não mostra a seção (`mostraDestaquesNoPerfil`). Destacar e tirar ficam na
// lista de conquistas do Detalhe e no seletor de "Escolher destaques" (ticket 04).
import { TEXTOS_DAS_CONQUISTAS, textoDoTotal } from '@dominio/conquistas';

import type { Esquemas } from '../api/tipos';
import { LinhaDaConquista } from '../conquistas/Conquista';
import { EscolherDestaques } from './SeletorDeDestaques';

/** O conteúdo da seção "Conquistas em destaque": o total, a dica nos automáticos e os destaques. */
export function ConquistasEmDestaque({ resposta }: { resposta: Esquemas['RespostaDestaques'] }) {
  const { destaques, automaticos, total } = resposta;
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-texto-suave">{textoDoTotal(total)}</p>
        <EscolherDestaques />
      </div>
      {automaticos ? <p className="text-[14px] text-texto">{TEXTOS_DAS_CONQUISTAS.dicaAutomaticos}</p> : null}
      <ul className="grid gap-3 sm:grid-cols-2">
        {destaques.map((d) => (
          <LinhaDaConquista
            key={`${d.id_lista}/${d.codigo}`}
            conquista={{ ...d, obtida: true }}
            jogo={d.jogo}
            comJogo
            cartao
          />
        ))}
      </ul>
    </>
  );
}
