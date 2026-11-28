import { Text, View } from 'react-native';

import { useLista } from '../api/lista';
import type { Sugestao } from '../api/tipos';
import { tituloDaMidia } from '@dominio/midia';
import { descricaoDaSugestao, TEXTOS_DAS_SUGESTOES, textoDoMotivo } from '@dominio/sugestoes';
import { CardMidia } from './CardMidia';
import { Fileira, LARGURA_CARD } from './Carrossel';
import { PlanejadoOuNaLista } from './PlanejadoOuNaLista';

/** O card A da Sugestão com a linha do motivo e, fora do toque do card, "Planejado" ou "Na Lista". */
function CartaoSugestao({ sugestao, naLista }: { sugestao: Sugestao; naLista: boolean | undefined }) {
  return (
    <View className="gap-2" style={{ width: LARGURA_CARD }}>
      <CardMidia
        midia={sugestao}
        largura={LARGURA_CARD}
        rotulo={descricaoDaSugestao(sugestao)}
        rodape={
          <Text numberOfLines={2} className="text-legenda italic text-texto-suave">
            {textoDoMotivo(sugestao.motivo)}
          </Text>
        }
      />
      <View className="mt-auto items-start">
        <PlanejadoOuNaLista idMidia={sugestao.id_midia} tipo={sugestao.tipo} titulo={tituloDaMidia(sugestao)} naLista={naLista} />
      </View>
    </View>
  );
}

/**
 * "Sugestões para você" (spec `sugestoes`): no Início e no fim das páginas da Lista. Quem chama
 * traz as Sugestões (`useSugestoes`); sem nenhuma, a faixa não aparece.
 */
export function FaixaSugestoes({ sugestoes, className }: { sugestoes: Sugestao[] | undefined; className?: string }) {
  const lista = useLista();
  return (
    <Fileira
      titulo={TEXTOS_DAS_SUGESTOES.faixa}
      itens={sugestoes ?? []}
      chave={(s) => s.id_midia}
      renderizar={(s) => (
        <CartaoSugestao sugestao={s} naLista={lista.data ? lista.data.some((i) => i.id_midia === s.id_midia) : undefined} />
      )}
      className={className}
    />
  );
}
