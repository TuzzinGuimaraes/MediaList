// Detalhe da Mídia (Resolution do 19 e do 29): banner largo com o pôster sobreposto; à
// esquerda, o botão carmesim da Lista e a ficha; à direita, título, sinopse, Atualizações,
// distribuição das notas, mapa de atividade e Avaliações.
import { useParams } from '@tanstack/react-router';
import { useState } from 'react';

import type { Esquemas } from '../../api/tipos';
import { Botao } from '../../componentes/Botao';
import { Carregando, ErroTela } from '../../componentes/Estados';
import { TituloSecao } from '../../componentes/Fileira';
import { FioProgresso } from '../../componentes/FioProgresso';
import { Icone } from '../../componentes/Icone';
import { Monograma } from '../../componentes/Monograma';
import { Selo, SeloStatus } from '../../componentes/Selo';
import { formatarData } from '@dominio/datas';
import { nomeDoRotulo, nomeDoTipo } from '@dominio/estadoConsumo';
import { proporcaoDoFio, temProgresso, textoDoProgresso } from '@dominio/itemLista';
import { atributosDoTipo, notasDaMidia, ROTULO_NOTA_MEDIA, tituloAlternativo, tituloDaMidia } from '@dominio/midia';
import { emLancamento } from '@dominio/situacao';
import { useItemDaMidia } from '../lista/api';
import { useEditorItem } from '../lista/EditorItemContext';
import { Avaliacoes } from './Avaliacoes';
import { useMidia } from './consultas';
import { DistribuicaoNotas } from './DistribuicaoNotas';
import { MapaAtividade } from './MapaAtividade';

type MidiaDetalhe = Esquemas['MidiaDetalhe'];
type Item = Esquemas['ItemLista'];

/** A nav fica sobre o banner; sem ele (carregando, erro), o conteúdo começa abaixo dela. */
const ABAIXO_DA_NAV = 'pt-[72px]';

export function Detalhe() {
  const { id } = useParams({ from: '/autenticado/midia/$id' });
  const midia = useMidia(id);
  if (midia.data) return <DetalheDaMidia midia={midia.data} />;
  return (
    <div className={ABAIXO_DA_NAV}>
      {midia.isError ? <ErroTela erro={midia.error} tentarDeNovo={() => void midia.refetch()} /> : <Carregando />}
    </div>
  );
}

function Banner({ midia }: { midia: MidiaDetalhe }) {
  const imagem = midia.banner_url ?? midia.poster_url;
  return (
    <div className="relative h-[320px] overflow-hidden bg-superficie lg:h-[440px]">
      {imagem ? (
        <img
          src={imagem}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover ${midia.banner_url ? '' : 'scale-110 blur-2xl'}`}
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-fundo" />
    </div>
  );
}

function Poster({ midia, item }: { midia: MidiaDetalhe; item: Item | null | undefined }) {
  const lancamento = emLancamento(midia);
  return (
    <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg border-2 border-fundo bg-superficie-alta shadow-2xl">
      {midia.poster_url ? (
        <img src={midia.poster_url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center">
          <Monograma tamanho={56} rotulo={null} />
        </div>
      )}
      {lancamento || item ? (
        <div className="absolute inset-x-1.5 bottom-2.5 flex flex-col gap-1">
          {lancamento ? <Selo texto={lancamento} tom="marca" /> : null}
          {item ? <SeloStatus rotulo={item.status_consumo} tipo={midia.tipo} sobreImagem /> : null}
        </div>
      ) : null}
      {item ? <FioProgresso proporcao={proporcaoDoFio(item)} grosso /> : null}
    </div>
  );
}

function Ficha({ midia, item }: { midia: MidiaDetalhe; item: Item | null | undefined }) {
  const lancamento = formatarData(midia.data_lancamento);
  const linhas: [string, string][] = [
    ...(item ? [['Status', nomeDoRotulo(item.status_consumo, midia.tipo)] as [string, string]] : []),
    ...(item && temProgresso(midia.tipo) ? [['Progresso', textoDoProgresso(item)] as [string, string]] : []),
    ['Tipo', nomeDoTipo(midia.tipo)],
    ...(lancamento ? [['Lançamento', lancamento] as [string, string]] : []),
    ...atributosDoTipo(midia),
  ];
  return (
    <dl aria-label="Ficha" className="flex flex-col divide-y divide-borda rounded-lg border border-borda bg-superficie">
      {linhas.map(([rotulo, valor]) => (
        <div key={rotulo} className="flex justify-between gap-4 px-4 py-2.5 text-[14px]">
          <dt className="text-texto-suave">{rotulo}</dt>
          <dd className="text-right font-semibold text-texto-forte">{valor}</dd>
        </div>
      ))}
    </dl>
  );
}

function BotaoDaLista({ midia }: { midia: MidiaDetalhe }) {
  const item = useItemDaMidia(midia.id_midia);
  const { abrirEditor } = useEditorItem();
  if (item.isError) return <ErroTela erro={item.error} tentarDeNovo={() => void item.refetch()} />;
  // Só com a Lista carregada se sabe se é adicionar ou editar.
  if (item.data === undefined) return <div className="h-12 rounded-md bg-superficie motion-safe:animate-pulse" />;
  return (
    <Botao
      tamanho="grande"
      className="w-full"
      icone={<Icone nome={item.data ? 'editar' : 'mais'} />}
      onClick={() => abrirEditor(midia, item.data ?? null)}
    >
      {item.data ? 'Editar na Lista' : 'Adicionar à Lista'}
    </Botao>
  );
}

function Cabecalho({ midia }: { midia: MidiaDetalhe }) {
  const alternativo = tituloAlternativo(midia);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-1.5">
        <Selo texto={nomeDoTipo(midia.tipo)} />
        {midia.generos_lista.map((g) => (
          <Selo key={g} texto={g} />
        ))}
      </div>
      <h1 className="text-[32px] font-bold leading-tight lg:text-[40px] text-texto-forte">{tituloDaMidia(midia)}</h1>
      {alternativo ? <p className="-mt-1 text-[16px] text-texto-suave">{alternativo}</p> : null}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        {notasDaMidia(midia).map((n) => (
          <span key={n.rotulo} aria-label={`${n.rotulo}: ${n.valor}`} className="inline-flex items-center gap-1.5">
            <Icone nome="estrela" tamanho={16} cheio={n.rotulo === ROTULO_NOTA_MEDIA} className="text-nota" />
            <span className="text-[18px] font-bold text-nota">{n.valor}</span>
            <span className="text-[13px] text-texto-suave">{n.rotulo}</span>
          </span>
        ))}
        <span className="text-[13px] text-texto-suave">
          Nas Listas de {midia.total_usuarios} {midia.total_usuarios === 1 ? 'Usuário' : 'Usuários'}
        </span>
      </div>
    </div>
  );
}

function Sinopse({ texto }: { texto: string | null }) {
  const [inteira, setInteira] = useState(false);
  if (!texto) return null;
  return (
    <section aria-labelledby="titulo-sinopse">
      <TituloSecao>
        <span id="titulo-sinopse">Sinopse</span>
      </TituloSecao>
      <p className={`whitespace-pre-line leading-relaxed text-texto ${inteira ? '' : 'line-clamp-5'}`}>{texto}</p>
      <button
        type="button"
        onClick={() => setInteira((v) => !v)}
        className="mt-1 text-[14px] text-marca-texto hover:underline"
      >
        {inteira ? 'Mostrar menos' : 'Mostrar mais'}
      </button>
    </section>
  );
}

function Atualizacoes({ atualizacoes }: { atualizacoes: MidiaDetalhe['atualizacoes'] }) {
  if (atualizacoes.length === 0) return null;
  return (
    <section aria-labelledby="titulo-atualizacoes">
      <TituloSecao>
        <span id="titulo-atualizacoes">Atualizações</span>
      </TituloSecao>
      <ul className="flex flex-col gap-2">
        {atualizacoes.map((a) => (
          <li
            key={`${a.data_atualizacao}-${a.titulo}`}
            className="rounded-lg border border-borda bg-superficie px-4 py-3"
          >
            <div className="flex items-baseline justify-between gap-4">
              <p className="font-semibold text-texto-forte">{a.titulo}</p>
              <span className="shrink-0 text-[12px] text-texto-suave">{formatarData(a.data_atualizacao)}</span>
            </div>
            {a.descricao ? <p className="text-[14px] text-texto">{a.descricao}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function DetalheDaMidia({ midia }: { midia: MidiaDetalhe }) {
  const item = useItemDaMidia(midia.id_midia);
  return (
    <div className="pb-24">
      <Banner midia={midia} />
      {/* Desktop: duas colunas. Abaixo de 1024px, uma só: o pôster ao lado do botão e da ficha, e o resto embaixo. */}
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-8 px-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10 lg:px-12">
        <div className="-mt-40 grid grid-cols-[180px_minmax(0,1fr)] items-start gap-6 lg:-mt-56 lg:flex lg:flex-col lg:gap-4">
          <Poster midia={midia} item={item.data} />
          {/* No tablet, começa onde o banner acaba, ao lado do pôster. */}
          <div className="flex flex-col gap-4 pt-40 lg:pt-0">
            <BotaoDaLista midia={midia} />
            <Ficha midia={midia} item={item.data} />
          </div>
        </div>
        <div className="flex flex-col gap-9 lg:-mt-28">
          <Cabecalho midia={midia} />
          <Sinopse texto={midia.sinopse} />
          <Atualizacoes atualizacoes={midia.atualizacoes} />
          <DistribuicaoNotas idMidia={midia.id_midia} />
          <MapaAtividade idMidia={midia.id_midia} />
          <Avaliacoes idMidia={midia.id_midia} />
        </div>
      </div>
    </div>
  );
}
