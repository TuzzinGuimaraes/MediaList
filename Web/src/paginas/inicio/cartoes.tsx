// Os cards do Início montados da Mídia e do Item, com as regras do dominio/.
import type { CartaoDaFaixa } from '@dominio/assistirAgora';
import { nomeDoProgresso, passoDeProgresso, textoDoProgresso } from '@dominio/itemLista';
import { type ComSituacao, emLancamento } from '@dominio/situacao';

import type { Esquemas } from '../../api/tipos';
import { Botao } from '../../componentes/Botao';
import { CardA, CardC, NotasCartao } from '../../componentes/Cards';
import { cartaoDaMidia } from '../../componentes/cartao';
import { Selo, SeloStatus } from '../../componentes/Selo';

type ItemLista = Esquemas['ItemLista'];
/** Em alta e GET /midias trazem a Mídia inteira; Populares, só o resumo. */
type MidiaDoCartao = Esquemas['MidiaPopular'] & Partial<ComSituacao>;

const LARGURA_A = 160;
const LARGURA_C = 340;
const ALTURA_C = 136;
/** O da faixa ganha a linha do "próximo em". */
const ALTURA_FAIXA = 172;

type Contexto = {
  /** Item da Mídia na Lista, se houver (selo de Status e fio). */
  item: ItemLista | undefined;
  posicaoTop: number | null;
};

/** Card A de um carrossel de catálogo: selos de lançamento e de Status sobre o pôster. */
export function CartaoCatalogo({ midia, item, posicaoTop, largura = LARGURA_A }: Contexto & { midia: MidiaDoCartao; largura?: number }) {
  const lancamento = emLancamento(midia);
  const selos =
    lancamento || item ? (
      <>
        {lancamento ? <Selo texto={lancamento} tom="marca" /> : null}
        {item ? <SeloStatus rotulo={item.status_consumo} tipo={item.tipo} sobreImagem /> : null}
      </>
    ) : null;
  return (
    <CardA
      {...cartaoDaMidia(midia, item)}
      notas={<NotasCartao midia={midia} />}
      selos={selos}
      posicaoTop={posicaoTop}
      largura={largura}
    />
  );
}

/**
 * Top 10: o numeral grande ao lado do card A. Os cards se alinham pelo topo (o título de 1 ou 2
 * linhas muda só o pé), e o numeral fica numa caixa da altura do pôster, com o pé dele no pé do
 * pôster: nada passa da altura do card, e o trilho da fileira não rola na vertical.
 */
export function CartaoTop({ posicao, ...props }: Contexto & { midia: MidiaDoCartao; posicao: number }) {
  const largura = LARGURA_A - 16;
  return (
    <div className="flex shrink-0 items-start">
      <span
        aria-hidden
        className="-mr-4 flex select-none items-end overflow-hidden text-[120px] font-bold leading-[0.75] tracking-[-0.06em] text-texto-suave/40"
        style={{ height: (largura * 3) / 2 }}
      >
        {posicao}
      </span>
      <CartaoCatalogo {...props} largura={largura} />
    </div>
  );
}

/** Card C do Continuar: Status, Progresso e o fio. */
export function CartaoContinuar({ item, posicaoTop }: Contexto & { item: ItemLista }) {
  return (
    <CardC
      {...cartaoDaMidia(item, item)}
      bannerUrl={item.banner_url}
      notas={<NotasCartao midia={item} />}
      status={<SeloStatus rotulo={item.status_consumo} tipo={item.tipo} />}
      detalhe={`${nomeDoProgresso(item.tipo)}: ${textoDoProgresso(item)}`}
      posicaoTop={posicaoTop}
      largura={LARGURA_C}
      altura={ALTURA_C}
    />
  );
}


/**
 * Card C do Para assistir agora: o atraso ou a contagem até o próximo episódio e, se atrasado,
 * a contagem numa linha só dela e o +1 (fora do link do card: botão não vai dentro de link).
 */
export function CartaoAssistirAgora({
  cartao: { item, atrasado, texto, proximo },
  posicaoTop,
  maisUm,
}: Omit<Contexto, 'item'> & { cartao: CartaoDaFaixa<ItemLista>; maisUm: (item: ItemLista) => void }) {
  const podeSomar = atrasado && passoDeProgresso(item, 1) !== null;
  const dados = cartaoDaMidia(item, item);
  return (
    <div className="relative shrink-0">
      <CardC
        {...dados}
        bannerUrl={item.banner_url}
        notas={<NotasCartao midia={item} />}
        status={
          <>
            <Selo texto={texto} tom={atrasado ? 'marca' : undefined} />
            {proximo ? <span className="text-[12px] font-semibold text-texto-suave">{proximo}</span> : null}
          </>
        }
        detalhe={`${nomeDoProgresso(item.tipo)}: ${textoDoProgresso(item)}`}
        posicaoTop={posicaoTop}
        largura={LARGURA_C}
        altura={ALTURA_FAIXA}
      />
      {podeSomar ? (
        <Botao
          variante="secundario"
          aria-label={`+1 episódio: ${dados.titulo}`}
          className="absolute bottom-2.5 right-2.5 bg-superficie/90"
          onClick={() => maisUm(item)}
        >
          +1
        </Botao>
      ) : null}
    </div>
  );
}
