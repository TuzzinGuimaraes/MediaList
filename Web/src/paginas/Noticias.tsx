// Notícias: paginadas pelo `total` da resposta; criar uma é só do admin (ADR 0012).
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { formatarData } from '@dominio/datas';

import { chaves } from '../api/chaves';
import { exigir } from '../api/cliente';
import { paginacao } from '../api/paginacao';
import type { Esquemas } from '../api/tipos';
import { Botao } from '../componentes/Botao';
import { Carregando, ErroTela, Vazio } from '../componentes/Estados';
import { Icone } from '../componentes/Icone';
import { Paginacao } from '../componentes/Paginacao';
import { ehAdmin } from '../sessao/sessao';
import { useApi, useUsuario } from '../sessao/SessaoContext';
import { NovaNoticia } from './NovaNoticia';

export const NOTICIAS_POR_PAGINA = 10;

export function CartaoNoticia({ noticia }: { noticia: Esquemas['Noticia'] }) {
  const data = formatarData(noticia.data_publicacao);
  return (
    <article aria-label={noticia.titulo} className="overflow-hidden rounded-xl bg-superficie">
      {noticia.imagem_url ? <img src={noticia.imagem_url} alt="" loading="lazy" className="h-56 w-full object-cover" /> : null}
      <div className="flex flex-col gap-2 p-6">
        <h2 className="text-[20px] font-bold text-texto-forte">{noticia.titulo}</h2>
        <p className="text-[13px] text-texto-suave">
          Por {noticia.autor}
          {data ? ` · ${data}` : ''}
        </p>
        {noticia.conteudo ? <p className="whitespace-pre-line leading-relaxed text-texto">{noticia.conteudo}</p> : null}
        {noticia.tags.length ? (
          <ul aria-label="Tags" className="mt-1 flex flex-wrap gap-1.5">
            {noticia.tags.map((tag) => (
              <li key={tag} className="rounded-sm bg-superficie-alta px-2 py-0.5 text-[12px] font-semibold text-marca-texto">
                {tag}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}

export function Noticias() {
  const api = useApi();
  const admin = ehAdmin(useUsuario());
  const [pagina, setPagina] = useState(1);
  const [criando, setCriando] = useState(false);

  const consulta = useQuery({
    queryKey: chaves.noticias.pagina(pagina),
    queryFn: () => exigir(api.GET('/api/noticias', { params: { query: { pagina, por_pagina: NOTICIAS_POR_PAGINA } } })),
    placeholderData: keepPreviousData,
  });

  const mudar = (nova: number) => {
    setPagina(nova);
    window.scrollTo({ top: 0 });
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[28px] font-bold text-texto-forte">Notícias</h1>
        {admin ? (
          <Botao icone={<Icone nome="mais" />} onClick={() => setCriando(true)}>
            Criar notícia
          </Botao>
        ) : null}
      </div>

      {consulta.data ? (
        consulta.data.itens.length ? (
          <>
            <div className="flex flex-col gap-5">
              {consulta.data.itens.map((n) => (
                <CartaoNoticia key={n.id_noticia} noticia={n} />
              ))}
            </div>
            <Paginacao paginacao={paginacao(consulta.data)} ir={mudar} />
          </>
        ) : (
          <Vazio texto="Nenhuma notícia disponível no momento." />
        )
      ) : consulta.isError ? (
        <ErroTela erro={consulta.error} tentarDeNovo={() => void consulta.refetch()} />
      ) : (
        <Carregando rotulo="Carregando notícias" />
      )}

      {admin ? (
        <NovaNoticia
          aberto={criando}
          fechar={() => setCriando(false)}
          publicada={() => {
            setCriando(false);
            setPagina(1);
          }}
        />
      ) : null}
    </main>
  );
}
