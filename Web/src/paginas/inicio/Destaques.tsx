// Destaques do Início (Resolution do 29): até 5 Mídias de Em alta em ~45vh, trocando a cada
// 6 s, com pausa no hover ou no foco e o indicador de pontos. Com "reduzir movimento", só à mão.
import { Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

import { estadoDe, nomeDoTipo } from '@dominio/estadoConsumo';
import { notasDaMidia, ROTULO_NOTA_MEDIA, tituloDaMidia } from '@dominio/midia';

import type { Esquemas } from '../../api/tipos';
import { Botao } from '../../componentes/Botao';
import { Icone } from '../../componentes/Icone';
import { Selo, SeloStatus } from '../../componentes/Selo';
import { useReduzirMovimento } from '../../tema/movimento';
import type { AbrirEditor } from './editorDoItem';

type Midia = Esquemas['Midia'];
type ItemLista = Esquemas['ItemLista'];

export const INTERVALO_DESTAQUES_MS = 6000;

type Props = {
  midias: Midia[];
  /** Itens da Lista; `undefined` enquanto ela carrega (o botão da Lista espera). */
  itens: ItemLista[] | undefined;
  posicaoTop(idMidia: string): number | null;
  abrirEditor: AbrirEditor;
};

function Fundo({ midia }: { midia: Midia }) {
  const imagem = midia.banner_url ?? midia.poster_url;
  return (
    <div aria-hidden className="absolute inset-0">
      {imagem ? (
        <img
          key={midia.id_midia}
          src={imagem}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover motion-safe:animate-[aparecer_600ms_ease-out] ${
            midia.banner_url ? '' : 'scale-110 blur-xl'
          }`}
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-fundo via-transparent to-black/30" />
    </div>
  );
}

function Destaque({ midia, item, posicaoTop, abrirEditor }: { midia: Midia; item: ItemLista | null | undefined } & Omit<Props, 'midias' | 'itens'>) {
  const titulo = tituloDaMidia(midia);
  const top = posicaoTop(midia.id_midia);
  const notas = notasDaMidia(midia);
  return (
    <div className="flex max-w-[620px] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Selo texto={nomeDoTipo(midia.tipo)} sobreImagem />
        {midia.generos_lista.slice(0, 3).map((g) => (
          <Selo key={g} texto={g} sobreImagem />
        ))}
        {top ? <Selo texto={`Top ${top}`} tom="marca" /> : null}
      </div>
      <h2 className="line-clamp-2 text-[40px] font-bold leading-[1.05] text-white drop-shadow">{titulo}</h2>
      <div className="flex flex-wrap items-center gap-3 text-[14px]">
        {notas.map((n) => (
          <span key={n.rotulo} aria-label={`${n.rotulo}: ${n.valor}`} className="flex items-center gap-1 text-white/75">
            <Icone nome="estrela" tamanho={14} cheio={n.rotulo === ROTULO_NOTA_MEDIA} className="text-nota" />
            <span className="font-bold text-nota">{n.valor}</span> {n.curto}
          </span>
        ))}
        {item ? <SeloStatus rotulo={item.status_consumo} tipo={item.tipo} sobreImagem /> : null}
      </div>
      {midia.sinopse ? <p className="line-clamp-2 max-w-[600px] text-[15px] text-white/80">{midia.sinopse}</p> : null}
      <div className="mt-1 flex gap-3">
        {item !== undefined ? (
          <Botao
            icone={<Icone nome={item ? 'editar' : 'mais'} />}
            aria-label={`${item ? 'Editar' : 'Adicionar à Lista'}: ${titulo}`}
            onClick={() => abrirEditor(midia, item)}
          >
            {item ? 'Editar' : 'Adicionar à Lista'}
          </Botao>
        ) : null}
        <Link
          to="/midia/$id"
          params={{ id: midia.id_midia }}
          aria-label={`Detalhes: ${titulo}`}
          className="inline-flex min-h-11 items-center rounded-md bg-white/15 px-4 text-[14px] font-bold text-white outline-none backdrop-blur hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-marca-texto"
        >
          Detalhes
        </Link>
      </div>
    </div>
  );
}

export function Destaques({ midias, itens, posicaoTop, abrirEditor }: Props) {
  const reduzir = useReduzirMovimento();
  const [pagina, setPagina] = useState(0);
  const [hover, setHover] = useState(false);
  const [foco, setFoco] = useState(false);
  const total = midias.length;
  const atual = Math.min(pagina, total - 1);
  const parado = reduzir || hover || foco;

  // Mudar de página (sozinho ou pelos pontos) recomeça a contagem.
  useEffect(() => {
    if (parado || total < 2) return;
    const id = setTimeout(() => setPagina((atual + 1) % total), INTERVALO_DESTAQUES_MS);
    return () => clearTimeout(id);
  }, [atual, total, parado]);

  const midia = midias[atual];
  if (!midia) return null;
  const item = itens ? (itens.find((i) => i.id_midia === midia.id_midia) ?? null) : undefined;

  return (
    <section
      aria-label="Destaques"
      aria-roledescription="carrossel"
      className="relative h-[45vh] min-h-[380px] overflow-hidden"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFoco(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFoco(false);
      }}
    >
      <Fundo midia={midia} />
      <div
        role="group"
        aria-roledescription="destaque"
        aria-label={`${atual + 1} de ${total}`}
        className="absolute inset-x-12 bottom-12"
      >
        <Destaque midia={midia} item={item} posicaoTop={posicaoTop} abrirEditor={abrirEditor} />
      </div>
      {total > 1 ? (
        <div className="absolute bottom-12 right-12 flex gap-2">
          {midias.map((m, i) => (
            <button
              key={m.id_midia}
              type="button"
              aria-label={`Destaque ${i + 1}: ${tituloDaMidia(m)}`}
              aria-current={i === atual || undefined}
              onClick={() => setPagina(i)}
              className="flex h-11 items-center rounded-full px-0.5 outline-none focus-visible:ring-2 focus-visible:ring-marca-texto"
            >
              <span
                className={`block h-1.5 rounded-full transition-all ${i === atual ? 'w-7 bg-marca-forte' : 'w-3 bg-white/40 hover:bg-white/70'}`}
              />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
