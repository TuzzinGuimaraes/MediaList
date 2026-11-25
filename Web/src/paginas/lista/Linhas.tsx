// Formatos em linha (veredito do ticket 39), as preferências de quem não quer a grade: a
// linha compacta (capa pequena, título e autoria) e a só texto (a mais densa). Cada grupo é
// uma tabela (role="table") com os cabeçalhos ordenáveis (aria-sort) e o corpo virtualizado;
// o título abre o cartão de destaque (Destaque.tsx). Status e Atualizado só a partir de md.
import { Link } from '@tanstack/react-router';

import { estadoDe, NOMES_ESTADO, type TipoMidia } from '@dominio/estadoConsumo';
import { crescente, type OrdemLista } from '@dominio/filtrosLista';
import { proporcaoDoFio, temProgresso } from '@dominio/itemLista';
import { tituloDaMidia } from '@dominio/midia';

import { FOCO } from '../../componentes/estilos';
import { FioProgresso } from '../../componentes/FioProgresso';
import { Icone } from '../../componentes/Icone';
import { Monograma } from '../../componentes/Monograma';
import type { ItemLista } from './api';
import type { Ordenacao, PropsColecao } from './Colecao';
import { useDestaque } from './destaqueContexto';
import { GradeVirtual } from './GradeVirtual';
import { MenuStatus } from './MenuStatus';
import { Consumo, Nota, PontoStatus } from './Pecas';
import { haQuanto, textos } from './textos';

/** Título, Nota, Progresso/Horas, Status, Atualizado (os dois últimos só a partir de md). */
const COLUNAS = 'grid-cols-[minmax(0,1fr)_64px_96px] md:grid-cols-[minmax(0,1fr)_72px_112px_148px_104px]';

const ALTURA = { compacta: 64, texto: 34 } as const;

const autoria = (i: ItemLista) => i.desenvolvedor ?? i.estudio ?? i.autor ?? null;

/** A coluna que a Ordem em vigor ordena: a padrão (Q120) é a nota no anime/mangá e as horas no jogo. */
function colunaDaOrdem(ordem: OrdemLista, tipo: TipoMidia | null): OrdemLista {
  if (ordem !== 'padrao') return ordem;
  return tipo === 'jogo' ? 'horas' : 'nota';
}

function Cabecalho({ tipo, ordenacao, capa }: { tipo: TipoMidia | null; ordenacao: Ordenacao; capa: boolean }) {
  const { ordem, inversa, mudar } = ordenacao;
  const ativa = colunaDaOrdem(ordem, tipo);
  const subindo = crescente(ordem, inversa);

  const coluna = (o: OrdemLista | null, rotulo: string, classe = '') => {
    if (!o)
      return (
        <span role="columnheader" className={`px-1.5 ${classe}`}>
          {rotulo}
        </span>
      );
    const esta = ativa === o;
    return (
      <span role="columnheader" aria-sort={esta ? (subindo ? 'ascending' : 'descending') : 'none'} className={classe}>
        <button
          type="button"
          // Na coluna ativa, inverte a direção (sem sair da Ordem padrão); noutra, ordena por ela na direção natural.
          onClick={() => mudar(esta ? { ordem, inversa: !inversa } : { ordem: o, inversa: false })}
          className={`inline-flex h-7 items-center gap-1 rounded px-1 uppercase tracking-wide transition-colors hover:text-texto-forte ${FOCO} ${esta ? 'text-texto-forte' : ''}`}
        >
          {rotulo}
          <span aria-hidden className={`w-3 text-[12px] ${esta ? 'text-marca-texto' : 'opacity-0'}`}>
            {esta && subindo ? '↑' : '↓'}
          </span>
          {esta && ordem === 'padrao' ? (
            <span className="rounded-sm bg-marca/25 px-1 text-[9px] normal-case tracking-normal text-marca-texto">{textos.ordemPadrao}</span>
          ) : null}
        </button>
      </span>
    );
  };
  return (
    <div
      role="row"
      aria-rowindex={1}
      className={`mb-1 grid h-9 items-center gap-3 border-b border-borda px-2 text-[11px] font-semibold uppercase tracking-wide text-texto-suave ${COLUNAS}`}
    >
      {coluna('titulo', textos.colunaTitulo, `justify-self-start ${capa ? 'ml-11' : '-ml-1'}`)}
      {coluna('nota', textos.colunaNota, 'justify-self-end -mr-1')}
      {coluna('horas', tipo === 'jogo' ? textos.colunaHoras : textos.colunaProgresso, 'justify-self-end -mr-1')}
      {coluna(null, textos.status, 'hidden md:block')}
      {coluna('atualizacao', textos.colunaAtualizado, 'hidden md:block justify-self-end -mr-1')}
    </div>
  );
}

function Favorito({ item }: { item: ItemLista }) {
  if (!item.favorito) return null;
  return (
    <span role="img" aria-label={textos.favorito} className="shrink-0 text-marca-texto">
      <Icone nome="coracao" tamanho={12} cheio />
    </span>
  );
}

function StatusDaLinha({ item, mudar }: { item: ItemLista; mudar: PropsColecao['mudarStatus'] }) {
  const estado = estadoDe(item.status_consumo, item.tipo);
  return (
    <MenuStatus
      item={item}
      mudar={mudar}
      classeBotao="inline-flex h-7 max-w-full items-center gap-1.5 rounded-md px-1.5 text-[12px] whitespace-nowrap text-texto transition-colors hover:bg-superficie-alta aria-expanded:bg-superficie-alta"
    >
      {estado ? <PontoStatus estado={estado} /> : null}
      <span className="truncate">{estado ? NOMES_ESTADO[estado] : item.status_consumo}</span>
      <Icone nome="baixo" tamanho={12} className="shrink-0 text-texto-suave opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" />
    </MenuStatus>
  );
}

type PropsLinha = { item: ItemLista; indice: number; formato: keyof typeof ALTURA; mudarStatus: PropsColecao['mudarStatus'] };

function Linha({ item, indice, formato, mudarStatus }: PropsLinha) {
  const destaque = useDestaque(item);
  const titulo = tituloDaMidia(item);
  const compacta = formato === 'compacta';
  const detalhe = compacta ? [autoria(item), item.generos_lista.slice(0, 2).join(', ')].filter(Boolean).join(' · ') : autoria(item);
  return (
    <div
      role="row"
      aria-rowindex={indice + 2}
      {...destaque.linha}
      style={{ height: ALTURA[formato] }}
      className={`group grid items-center gap-3 px-2 transition-colors hover:bg-superficie focus-within:bg-superficie ${COLUNAS} ${
        compacta ? 'rounded-md' : 'border-b border-borda/40 text-[13px]'
      }`}
    >
      <span role="cell" className={`flex min-w-0 items-center ${compacta ? 'gap-3' : 'gap-2'}`}>
        {compacta ? (
          <span aria-hidden className="relative flex h-[54px] w-9 shrink-0 items-center justify-center overflow-hidden rounded-[3px] bg-superficie-alta">
            {item.poster_url ? (
              <img src={item.poster_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
            ) : (
              <Monograma tamanho={14} rotulo={null} />
            )}
            {temProgresso(item.tipo) ? <FioProgresso proporcao={proporcaoDoFio(item)} /> : null}
          </span>
        ) : null}
        <span className={`flex min-w-0 ${compacta ? 'flex-col gap-0.5' : 'items-center gap-2'}`}>
          <Link
            to="/midia/$id"
            params={{ id: item.id_midia }}
            {...destaque.titulo}
            className={`flex min-w-0 items-center gap-1.5 rounded font-semibold text-texto-forte hover:underline ${compacta ? 'text-[14px]' : ''} ${FOCO}`}
          >
            <span className="truncate">{titulo}</span>
            <Favorito item={item} />
          </Link>
          {detalhe ? <span className={`truncate text-[12px] text-texto-suave ${compacta ? '' : 'hidden lg:inline'}`}>{detalhe}</span> : null}
        </span>
      </span>
      <span role="cell" className="justify-self-end">
        <Nota nota={item.nota_usuario} tamanho={compacta ? 14 : 13} />
      </span>
      <span role="cell" className="justify-self-end">
        <Consumo item={item} tamanho={compacta ? (temProgresso(item.tipo) ? 14 : 17) : 13} />
      </span>
      <span role="cell" className="hidden min-w-0 md:block">
        <StatusDaLinha item={item} mudar={mudarStatus} />
      </span>
      <span role="cell" className="hidden justify-self-end text-[12px] text-texto-suave md:block">
        {haQuanto(item.data_atualizacao)}
      </span>
    </div>
  );
}

function Linhas({ itens, tipo, rotulo, ordenacao, mudarStatus, formato }: PropsColecao & { formato: keyof typeof ALTURA }) {
  return (
    <div role="table" aria-label={rotulo} aria-rowcount={itens.length + 1}>
      <div role="rowgroup">
        <Cabecalho tipo={tipo} ordenacao={ordenacao} capa={formato === 'compacta'} />
      </div>
      <GradeVirtual
        itens={itens}
        chave={(i) => i.id_lista}
        minima={0}
        gap={0}
        altura={() => ALTURA[formato]}
        papel="linhas"
        render={(item, indice) => <Linha item={item} indice={indice} formato={formato} mudarStatus={mudarStatus} />}
      />
    </div>
  );
}

export const LinhasCompactas = (props: PropsColecao) => <Linhas {...props} formato="compacta" />;
export const LinhasTexto = (props: PropsColecao) => <Linhas {...props} formato="texto" />;
