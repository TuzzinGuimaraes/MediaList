import { foraDe } from '@dominio/inicio';

import { useCatalogo } from '../../catalogo/CatalogoContext';
import { useEmAlta } from '../../catalogo/consultas';
import { CardA, NotasCartao } from '../../componentes/Cards';
import { cartaoDaMidia } from '../../componentes/cartao';
import { Fileira } from '../../componentes/Fileira';
import type { ItemLista } from './api';
import { textos } from './textos';

/** Quantas Mídias de cada Tipo o Em alta traz para as Sugestões (antes de tirar as que já estão na Lista). */
const LIMITE_SUGESTOES = 20;

/** "Sugestões para você": Em alta do catálogo fora da Lista, no card A. */
export function Sugestoes({ lista }: { lista: ItemLista[] }) {
  const { recorte } = useCatalogo();
  const emAlta = useEmAlta(recorte, LIMITE_SUGESTOES);
  const sugestoes = foraDe(emAlta.data, lista);
  return (
    <div className="mt-12">
      <Fileira titulo={textos.sugestoes} vazia={sugestoes.length === 0}>
        {sugestoes.map((m) => (
          <CardA key={m.id_midia} {...cartaoDaMidia(m)} notas={<NotasCartao midia={m} />} largura={160} />
        ))}
      </Fileira>
    </div>
  );
}
