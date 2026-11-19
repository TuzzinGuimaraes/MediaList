// Monta as props dos cards (Cards.tsx) a partir da Mídia e do Item, com as regras do dominio/.
import { nomeDoTipo } from '@dominio/estadoConsumo';
import { proporcaoDoFio } from '@dominio/itemLista';
import { tituloDaMidia } from '@dominio/midia';
import type { Midia } from '@dominio/tipos';

import type { PropsCartao } from './Cards';

type MidiaDoCartao = Pick<Midia, 'id_midia' | 'titulo_portugues' | 'titulo_original' | 'poster_url' | 'tipo'>;
type ItemDoCartao = Parameters<typeof proporcaoDoFio>[0];

/** Título, pôster e Tipo da Mídia; com Item na Lista, também o fio de progresso. */
export function cartaoDaMidia(
  midia: MidiaDoCartao,
  item?: ItemDoCartao | null,
): Pick<PropsCartao, 'idMidia' | 'titulo' | 'posterUrl' | 'tipo' | 'progresso'> {
  return {
    idMidia: midia.id_midia,
    titulo: tituloDaMidia(midia),
    posterUrl: midia.poster_url,
    tipo: nomeDoTipo(midia.tipo),
    ...(item ? { progresso: proporcaoDoFio(item) } : {}),
  };
}
