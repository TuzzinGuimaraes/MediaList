// PROTÓTIPO, eixo `detalhe`: "Duas colunas" (banner largo, pôster sobreposto à esquerda com o
// botão carmesim e a ficha; conteúdo e Avaliações à direita) × "Coluna central" (banner largo e
// tudo numa coluna de ~900px, layout A do app com o botão grande abaixo do título).
import { useParams } from '@tanstack/react-router';
import { useState } from 'react';

import { useAvaliacoes, useItemDe, useMidia, useNotas } from '../api';
import { BotaoDaLista, Carregando, EditorItem, FioProgresso, Notas, Selo, SeloStatus, SeloTop, Stepper, TituloSecao, usePosicaoTop10 } from '../componentes';
import {
  atributosDe,
  emLancamento,
  estadoDe,
  formatarData,
  type ItemLista,
  type MidiaDetalhe,
  NOMES_TIPO,
  recontagem,
  tituloAlternativo,
  tituloDe,
  UNIDADE,
} from '../dominio';
import { Icone } from '../icones';
import { useVariante } from '../variantes';

export function Detalhe() {
  const { id } = useParams({ from: '/autenticado/midia/$id' });
  const variante = useVariante('detalhe');
  const midia = useMidia(id);
  const item = useItemDe(id);
  if (!midia.data) return <div className="pt-[var(--topo)]">{midia.isError ? <p className="p-12 text-erro">{midia.error.message}</p> : <Carregando />}</div>;
  return variante === 'central' ? <DetalheCentral midia={midia.data} item={item} /> : <DetalheDuasColunas midia={midia.data} item={item} />;
}

type Props = { midia: MidiaDetalhe; item: ItemLista | null | undefined };

function Banner({ midia, altura }: { midia: MidiaDetalhe; altura: string }) {
  const img = midia.banner_url ?? midia.poster_url;
  return (
    <div className="relative overflow-hidden bg-superficie" style={{ height: altura }}>
      {img ? <img src={img} alt="" className={`absolute inset-0 h-full w-full object-cover ${midia.banner_url ? '' : 'scale-110 blur-2xl'}`} /> : null}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-fundo" />
    </div>
  );
}

function Poster({ midia, item, largura }: Props & { largura: number }) {
  const top = usePosicaoTop10(midia.id_midia);
  const lancamento = emLancamento(midia);
  const estado = item ? estadoDe(item.status_consumo, midia.tipo) : null;
  return (
    <div className="relative aspect-[2/3] shrink-0 overflow-hidden rounded-lg border-2 border-fundo bg-superficie-alta shadow-2xl" style={{ width: largura }}>
      {midia.poster_url ? <img src={midia.poster_url} alt="" className="h-full w-full object-cover" /> : null}
      {top ? (
        <div className="absolute right-0 top-0">
          <SeloTop posicao={top} />
        </div>
      ) : null}
      {lancamento || estado ? (
        <div className="absolute inset-x-1.5 bottom-2 flex flex-col gap-1">
          {lancamento ? <Selo texto={lancamento} tom="marca" /> : null}
          {estado ? <SeloStatus estado={estado} sobreImagem /> : null}
        </div>
      ) : null}
      {item ? <FioProgresso item={item} grosso /> : null}
    </div>
  );
}

/** Resumo do Item do Usuário: Status, Progresso com stepper, Nota pessoal, Recontagem. */
function MeuItem({ item }: { item: ItemLista }) {
  const estado = estadoDe(item.status_consumo, item.tipo);
  const rec = recontagem(item);
  const [editando, setEditando] = useState(false);
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border border-borda bg-superficie p-4">
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-texto-suave">Na sua Lista</span>
        <button onClick={() => setEditando(true)} className="text-[13px] text-marca-texto hover:underline">
          Editar
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {estado ? <SeloStatus estado={estado} /> : null}
        {item.nota_usuario != null ? (
          <span className="inline-flex items-center gap-1 text-[13px] font-bold text-nota">
            <Icone nome="estrela" tamanho={13} cheio /> {item.nota_usuario}
          </span>
        ) : null}
        {item.favorito ? <Icone nome="coracao" tamanho={14} cheio className="text-marca-texto" /> : null}
        {rec ? <span className="text-[13px] text-texto-suave">{rec}</span> : null}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[13px] text-texto-suave">{UNIDADE[item.tipo]}</span>
        <Stepper item={item} />
      </div>
      {editando ? <EditorItem midia={item} item={item} fechar={() => setEditando(false)} /> : null}
    </div>
  );
}

function Ficha({ midia, emLinha }: { midia: MidiaDetalhe; emLinha?: boolean }) {
  const atributos = atributosDe(midia);
  if (emLinha)
    return (
      <dl className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
        {atributos.map(([r, v]) => (
          <div key={r} className="rounded-md bg-superficie px-3 py-2">
            <dt className="text-[12px] text-texto-suave">{r}</dt>
            <dd className="line-clamp-2 text-[14px] font-semibold text-texto-forte">{v}</dd>
          </div>
        ))}
      </dl>
    );
  return (
    <dl className="flex flex-col divide-y divide-borda rounded-lg border border-borda bg-superficie">
      {atributos.map(([r, v]) => (
        <div key={r} className="flex justify-between gap-4 px-4 py-2.5 text-[14px]">
          <dt className="text-texto-suave">{r}</dt>
          <dd className="text-right font-semibold text-texto-forte">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Cabecalho({ midia, centro }: { midia: MidiaDetalhe; centro?: boolean }) {
  const alt = tituloAlternativo(midia);
  return (
    <div className={`flex flex-col gap-2.5 ${centro ? 'items-center text-center' : ''}`}>
      <div className="flex flex-wrap gap-1.5">
        <Selo texto={NOMES_TIPO[midia.tipo]} />
        {midia.generos_lista.map((g) => (
          <Selo key={g} texto={g} />
        ))}
      </div>
      <h1 className="text-[40px] font-bold leading-tight text-texto-forte">{tituloDe(midia)}</h1>
      {alt ? <p className="-mt-1 text-[16px] text-texto-suave">{alt}</p> : null}
      <Notas midia={midia} grande />
    </div>
  );
}

function Sinopse({ texto }: { texto: string | null }) {
  const [inteira, setInteira] = useState(false);
  if (!texto) return null;
  return (
    <section>
      <TituloSecao>Sinopse</TituloSecao>
      <p className={`whitespace-pre-line leading-relaxed text-texto ${inteira ? '' : 'line-clamp-5'}`}>{texto}</p>
      <button onClick={() => setInteira((v) => !v)} className="mt-1 text-[14px] text-marca-texto hover:underline">
        {inteira ? 'Mostrar menos' : 'Mostrar mais'}
      </button>
    </section>
  );
}

/** Avaliações (leitura): a distribuição das notas e a 1ª página. Escrever não é prototipado. */
function Avaliacoes({ midia }: { midia: MidiaDetalhe }) {
  const pagina = useAvaliacoes(midia.id_midia);
  const notas = useNotas(midia.id_midia);
  const dist = notas.data?.distribuicao ?? [];
  const maior = Math.max(1, ...dist.map((d) => d.total));
  return (
    <section>
      <TituloSecao direita={<button className="text-[14px] text-marca-texto hover:underline">Escrever avaliação</button>}>
        Avaliações {midia.total_avaliacoes ? <span className="text-[16px] font-normal text-texto-suave">· {midia.total_avaliacoes}</span> : null}
      </TituloSecao>
      {dist.some((d) => d.total) ? (
        <div className="mb-5 flex h-20 items-end gap-1.5">
          {dist.map((d) => (
            <div key={d.nota} className="flex flex-1 flex-col items-center gap-1">
              <div className="w-full rounded-t bg-marca/70" style={{ height: `${(d.total / maior) * 56}px` }} title={`${d.total}`} />
              <span className="text-[11px] text-texto-suave">{d.nota}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="flex flex-col gap-3">
        {pagina.data?.itens.length ? (
          pagina.data.itens.map((a) => (
            <article key={a.id_avaliacao} className="rounded-lg border border-borda bg-superficie p-4">
              <div className="mb-2 flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-superficie-alta font-bold text-texto-forte">{a.nome_completo[0]}</span>
                <div className="flex-1">
                  <p className="text-[14px] font-semibold text-texto-forte">{a.nome_completo}</p>
                  <p className="text-[12px] text-texto-suave">{formatarData(a.data_avaliacao)}</p>
                </div>
                <span className="inline-flex items-center gap-1 font-bold text-nota">
                  <Icone nome="estrela" tamanho={14} cheio /> {a.nota}
                </span>
              </div>
              {a.titulo_avaliacao ? <p className="font-semibold text-texto-forte">{a.titulo_avaliacao}</p> : null}
              {a.texto_avaliacao ? <p className="text-[14px] text-texto">{a.texto_avaliacao}</p> : null}
            </article>
          ))
        ) : (
          <p className="text-texto-suave">Ninguém avaliou ainda.</p>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Duas colunas

function DetalheDuasColunas({ midia, item }: Props) {
  return (
    <div className="pb-24">
      <Banner midia={midia} altura="440px" />
      <div className="mx-auto grid max-w-[1280px] grid-cols-[260px_minmax(0,1fr)] gap-10 px-12">
        <div className="-mt-56 flex flex-col gap-4">
          <Poster midia={midia} item={item} largura={260} />
          <BotaoDaLista midia={midia} grande largo />
          {item ? <MeuItem item={item} /> : null}
          <Ficha midia={midia} />
        </div>
        <div className="-mt-28 flex flex-col gap-9">
          <Cabecalho midia={midia} />
          <Sinopse texto={midia.sinopse} />
          <Avaliacoes midia={midia} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Coluna central

function DetalheCentral({ midia, item }: Props) {
  return (
    <div className="pb-24">
      <Banner midia={midia} altura="480px" />
      <div className="mx-auto -mt-64 flex max-w-[900px] flex-col gap-9 px-6">
        <div className="flex items-end gap-7">
          <Poster midia={midia} item={item} largura={190} />
          <div className="flex min-w-0 flex-1 flex-col gap-4 pb-1">
            <Cabecalho midia={midia} />
            <div className="flex items-center gap-4">
              <BotaoDaLista midia={midia} grande />
              {item ? (
                <div className="flex items-center gap-3">
                  {estadoDe(item.status_consumo, item.tipo) ? <SeloStatus estado={estadoDe(item.status_consumo, item.tipo)!} /> : null}
                  <Stepper item={item} />
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <Ficha midia={midia} emLinha />
        <Sinopse texto={midia.sinopse} />
        <Avaliacoes midia={midia} />
      </div>
    </div>
  );
}
