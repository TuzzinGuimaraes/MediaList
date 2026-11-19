// Perfil: dados da conta, resumo e estatísticas da Lista pessoal, favoritos do catálogo,
// o seletor de tema (Resolution do 29) e as Notificações.
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { rotuloNivelAcesso } from '@dominio/conta';
import { formatarData } from '@dominio/datas';
import { formatarMedia } from '@dominio/estatisticas';

import { exigir } from '../api/cliente';
import { CardA, NotasCartao } from '../componentes/Cards';
import { cartaoDaMidia } from '../componentes/cartao';
import { Carregando, ErroTela } from '../componentes/Estados';
import { useCatalogo } from '../catalogo/CatalogoContext';
import { useApi, useUsuario } from '../sessao/SessaoContext';
import { SeletorTema } from '../tema/SeletorTema';
import { EstatisticasPerfil } from './EstatisticasPerfil';
import { NotificacoesPerfil } from './NotificacoesPerfil';

const MAX_FAVORITOS = 12;

function Secao({ titulo, children, className = '' }: { titulo: string; children: ReactNode; className?: string }) {
  const id = `secao-${titulo.normalize('NFD').replace(/[^\w]/g, '').toLowerCase()}`;
  return (
    <section aria-labelledby={id} className={`flex flex-col gap-4 rounded-xl bg-superficie p-6 ${className}`}>
      <h2 id={id} className="text-[18px] font-bold text-texto-forte">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

/** Consultas de uma seção: o conteúdo com os dados, ou o carregando/erro no lugar dele. */
function Estado({ consultas, children }: { consultas: { isError: boolean; error: unknown; refetch(): unknown }[]; children: ReactNode }) {
  const falha = consultas.find((c) => c.isError);
  if (falha) return <ErroTela erro={falha.error} tentarDeNovo={() => consultas.forEach((c) => c.isError && void c.refetch())} />;
  return children ?? <Carregando />;
}

export function Perfil() {
  const api = useApi();
  const usuario = useUsuario();
  const { tipos } = useCatalogo();

  const perfil = useQuery({
    queryKey: ['usuario', 'perfil'],
    queryFn: () => exigir(api.GET('/api/usuario/perfil')),
    select: (r) => r.perfil,
  });
  const estatisticas = useQuery({
    queryKey: ['usuario', 'estatisticas'],
    queryFn: () => exigir(api.GET('/api/usuario/estatisticas')),
  });
  const lista = useQuery({
    queryKey: ['lista', 'perfil'],
    queryFn: () => exigir(api.GET('/api/lista')),
    select: (r) => r.lista,
  });

  const desde = formatarData(perfil.data?.data_cadastro);
  const favoritos = lista.data?.filter((i) => i.favorito && tipos.includes(i.tipo)).slice(0, MAX_FAVORITOS);
  const resumo = estatisticas.data?.resumo;

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-6 py-10 lg:grid-cols-[minmax(0,1fr)_360px]">
      <header className="flex items-center gap-5 lg:col-span-2">
        <span aria-hidden className="flex h-20 w-20 items-center justify-center rounded-xl bg-marca text-[32px] font-bold text-sobre-marca">
          {usuario.nome.trim()[0]?.toUpperCase() ?? '?'}
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] font-bold text-texto-forte">{usuario.nome}</h1>
          <p className="text-texto-suave">{usuario.email}</p>
          {perfil.data ? (
            <p className="flex flex-wrap gap-x-3 text-[14px] text-texto-suave">
              <span>{rotuloNivelAcesso(perfil.data.nivel_acesso)}</span>
              {desde ? <span>Membro desde {desde}</span> : null}
            </p>
          ) : null}
        </div>
      </header>

      <div className="flex min-w-0 flex-col gap-6">
        <Secao titulo="Resumo">
          <Estado consultas={[perfil, estatisticas]}>
            {resumo && perfil.data ? (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  ['Na Lista', resumo.total_midias],
                  ['Concluídos', resumo.concluidos],
                  ['Em progresso', resumo.em_andamento],
                  ['Favoritos', resumo.favoritos],
                  ['Média das notas pessoais', formatarMedia(perfil.data.nota_media_usuario)],
                ].map(([rotulo, valor]) => (
                  <li key={rotulo} aria-label={`${rotulo}: ${valor}`} className="flex flex-col rounded-lg bg-superficie-alta px-4 py-3">
                    <span aria-hidden className="text-[24px] font-bold text-texto-forte">
                      {valor}
                    </span>
                    <span aria-hidden className="text-[13px] text-texto-suave">
                      {rotulo}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Estado>
        </Secao>

        <Secao titulo="Estatísticas">
          <Estado consultas={[estatisticas, lista]}>
            {estatisticas.data && lista.data ? (
              <EstatisticasPerfil itens={lista.data} porTipo={estatisticas.data.estatisticas} />
            ) : null}
          </Estado>
        </Secao>

        <Secao titulo="Favoritos">
          <Estado consultas={[lista]}>
            {favoritos ? (
              favoritos.length ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-4">
                  {favoritos.map((i) => (
                    <CardA key={i.id_lista} {...cartaoDaMidia(i)} notas={<NotasCartao midia={i} />} />
                  ))}
                </div>
              ) : (
                <p className="text-texto-suave">Marque um Item como favorito na sua Lista e ele aparece aqui.</p>
              )
            ) : null}
          </Estado>
        </Secao>
      </div>

      <div className="flex flex-col gap-6">
        <Secao titulo="Aparência">
          <SeletorTema />
        </Secao>
        <Secao titulo="Notificações">
          <NotificacoesPerfil />
        </Secao>
      </div>
    </main>
  );
}
