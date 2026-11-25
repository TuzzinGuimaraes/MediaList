// Formato grade de capas, o padrão (veredito do ticket 39): capa 2:3 com tudo dentro dela.
// Nota pequena no canto superior direito, nome completo no inferior esquerdo (quebra em
// quantas linhas precisar), Progresso/horas no inferior direito e o ⋯ de Status no superior
// esquerdo, que aparece no hover/foco (sempre visível no toque).
import { Link } from '@tanstack/react-router';

import { estadoDe, NOMES_ESTADO } from '@dominio/estadoConsumo';
import { proporcaoDoFio, temProgresso } from '@dominio/itemLista';
import { tituloDaMidia } from '@dominio/midia';

import { FioProgresso } from '../../componentes/FioProgresso';
import { Icone } from '../../componentes/Icone';
import { Monograma } from '../../componentes/Monograma';
import { Selo } from '../../componentes/Selo';
import type { ItemLista } from './api';
import type { PropsColecao } from './Colecao';
import { GradeVirtual } from './GradeVirtual';
import { FOCO, MenuStatus } from './MenuStatus';
import { formatarNumero, textoDoConsumo } from './textos';

const LARGURA_MINIMA = 150;
const GAP = 16;

// Degradê sólido sob o texto, esmaecendo só nos 48 px de cima: branco sobre ≥ 85% de preto
// passa de 4,5:1 (AA) mesmo sobre uma capa branca.
const DEGRADE = 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.85) calc(100% - 48px), rgba(0,0,0,0) 100%)';

const UNIDADE = { anime: 'ep', manga: 'cap' } as const;

/** O nome do link: título, nota e Progresso/horas, como o leitor de tela deve ouvir. */
function rotuloDoCard(item: ItemLista, consumo: string | null, platinado: boolean): string {
  const partes = [tituloDaMidia(item)];
  if (platinado) partes.push('platinado');
  if (item.nota_usuario != null) partes.push(`nota ${formatarNumero(item.nota_usuario)}`);
  if (item.favorito) partes.push('favorito');
  if (consumo) partes.push(item.tipo === 'jogo' ? `${consumo} jogadas` : `${consumo} ${UNIDADE[item.tipo]}`);
  return partes.join(', ');
}

export function CardCapa({ item, mudarStatus }: { item: ItemLista; mudarStatus: PropsColecao['mudarStatus'] }) {
  const titulo = tituloDaMidia(item);
  const consumo = textoDoConsumo(item);
  // No "Todos" o platinado fica no Concluído: o selo diz que é mais que concluído.
  const platinado = estadoDe(item.status_consumo, item.tipo) === 'platinado';
  return (
    <article className="group relative h-full">
      <Link
        to="/midia/$id"
        params={{ id: item.id_midia }}
        aria-label={rotuloDoCard(item, consumo, platinado)}
        className={`absolute inset-0 overflow-hidden rounded-md bg-superficie-alta shadow-[0_2px_10px_rgba(0,0,0,0.35)] ring-white/20 transition-shadow group-hover:ring-1 ${FOCO}`}
      >
        {item.poster_url ? (
          <img
            src={item.poster_url}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.03]"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center">
            <Monograma tamanho={32} rotulo={null} />
          </span>
        )}
        {item.nota_usuario != null || item.favorito ? (
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-black/75 px-1.5 py-[3px] text-[11px] font-semibold leading-none tabular-nums text-nota backdrop-blur-sm"
          >
            {item.favorito ? <Icone nome="coracao" tamanho={10} cheio className="text-marca-texto" /> : null}
            {item.nota_usuario != null ? (
              <>
                <Icone nome="estrela" tamanho={10} cheio /> {formatarNumero(item.nota_usuario)}
              </>
            ) : null}
          </span>
        ) : null}
        <span aria-hidden className="absolute inset-x-0 bottom-0 flex items-end gap-2 px-2 pb-2.5 pt-12" style={{ backgroundImage: DEGRADE }}>
          <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
            {platinado ? <Selo texto={NOMES_ESTADO.platinado} tom="platinado" sobreImagem /> : null}
            <span className="text-[12.5px] font-semibold leading-[1.25] text-white [overflow-wrap:anywhere] [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
              {titulo}
            </span>
          </span>
          {consumo ? <span className="shrink-0 text-[11.5px] font-semibold leading-[1.25] tabular-nums text-white/90">{consumo}</span> : null}
        </span>
        {temProgresso(item.tipo) ? <FioProgresso proporcao={proporcaoDoFio(item)} /> : null}
      </Link>
      <div className="absolute left-1.5 top-1.5">
        <MenuStatus
          item={item}
          mudar={mudarStatus}
          classeBotao="flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-sm transition-opacity hover:bg-black/90 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 aria-expanded:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="19" cy="12" r="2" />
          </svg>
        </MenuStatus>
      </div>
    </article>
  );
}

/** A grade de capas de um grupo, virtualizada; a altura da linha é a da capa 2:3. */
export function GradeCapas({ itens, rotulo, mudarStatus }: PropsColecao) {
  return (
    <GradeVirtual
      itens={itens}
      chave={(i) => i.id_lista}
      minima={LARGURA_MINIMA}
      gap={GAP}
      altura={(largura) => largura * 1.5}
      rotulo={rotulo}
      render={(item) => <CardCapa item={item} mudarStatus={mudarStatus} />}
    />
  );
}
