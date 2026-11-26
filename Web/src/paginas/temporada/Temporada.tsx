// Temporada de anime (ticket 49 da revisão): os animes de uma Temporada, abrindo na atual, com
// atalhos para a anterior e a próxima, o seletor (da mais antiga do Catálogo até 4 à frente) e a
// ordem, tudo na URL (busca.ts). Séries na grade principal; filmes e especiais numa seção no fim.
// O cartão põe o anime em Planejado num toque, e a estreia chega como push.
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getRouteApi, Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { formatarData } from '@dominio/datas';
import { tituloDaMidia } from '@dominio/midia';
import {
  animesDaTemporada,
  anterior,
  consultaDaTemporada,
  mesmaTemporada,
  ORDEM_PADRAO_DA_TEMPORADA,
  ORDENS_DA_TEMPORADA,
  type OrdemTemporada,
  proxima,
  rotuloDaTemporada,
  secoesDaTemporada,
  seloDeEstimativa,
  type Temporada as TemporadaDoDominio,
  temporadaDe,
  temporadaDosParametros,
  temporadasDoSeletor,
  TITULO_FILMES_E_ESPECIAIS,
} from '@dominio/temporada';
import type { Midia } from '@dominio/tipos';

import { chaves } from '../../api/chaves';
import { exigir } from '../../api/cliente';
import { mensagemDeErro } from '../../api/erros';
import { Botao } from '../../componentes/Botao';
import { CardA, NotasCartao } from '../../componentes/Cards';
import { cartaoDaMidia } from '../../componentes/cartao';
import { Carregando, ErroTela, Vazio } from '../../componentes/Estados';
import { Icone } from '../../componentes/Icone';
import { Opcoes } from '../../componentes/Opcoes';
import { TituloSecao } from '../../componentes/Fileira';
import { useApi } from '../../sessao/SessaoContext';
import { useLista, usePorEmPlanejado } from '../lista/api';

const rota = getRouteApi('/autenticado/temporada');

const chave = (t: TemporadaDoDominio) => `${t.estacao}-${t.ano}`;

/** As ordens no formato de `Opcoes`. */
const ORDENS = ORDENS_DA_TEMPORADA.map((o) => ({ valor: o.valor, nome: o.rotulo }));

/** Todos os animes da Temporada, página por página, na ordem pedida. */
function useAnimesDaTemporada(temporada: TemporadaDoDominio, ordem: OrdemTemporada) {
  const api = useApi();
  return useQuery({
    queryKey: chaves.midias.temporada(temporada.estacao, temporada.ano, ordem),
    queryFn: () =>
      animesDaTemporada((pagina) =>
        exigir(api.GET('/api/midias', { params: { query: consultaDaTemporada(temporada, ordem, pagina) } })),
      ),
    placeholderData: keepPreviousData,
  });
}

export function Temporada() {
  const busca = rota.useSearch();
  const navigate = rota.useNavigate();
  const agora = new Date();
  const atual = temporadaDe(agora);
  const temporada = temporadaDosParametros(busca, agora);
  const ordem = busca.ordem ?? ORDEM_PADRAO_DA_TEMPORADA;

  const api = useApi();
  const facetas = useQuery({
    queryKey: chaves.catalogo.facetas('anime'),
    queryFn: () => exigir(api.GET('/api/midias/facetas', { params: { query: { tipo: 'anime' } } })),
    staleTime: Infinity,
  });
  const animes = useAnimesDaTemporada(temporada, ordem);
  const lista = useLista();

  const seletor = temporadasDoSeletor(facetas.data?.temporada_mais_antiga ?? null, agora);
  // A Temporada da URL fora do seletor (antes da mais antiga) também aparece nele.
  const opcoes = seletor.some((t) => mesmaTemporada(t, temporada)) ? seletor : [temporada, ...seletor];
  const primeira = opcoes[0]!;
  const ultima = opcoes[opcoes.length - 1]!;

  const irPara = (t: TemporadaDoDominio) =>
    void navigate({ search: { ...(mesmaTemporada(t, atual) ? {} : { estacao: t.estacao, ano: t.ano }), ...(busca.ordem ? { ordem: busca.ordem } : {}) } });
  const mudarOrdem = (nova: OrdemTemporada) =>
    void navigate({ search: { ...busca, ordem: nova === ORDEM_PADRAO_DA_TEMPORADA ? undefined : nova }, replace: true });

  const rotulo = rotuloDaTemporada(temporada);
  const naLista = new Set((lista.data ?? []).map((i) => i.id_midia));

  return (
    <div className="flex flex-col gap-8 px-6 pb-24 pt-6 md:px-12">
      <header className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[14px] font-semibold text-texto-suave">Temporada de anime</p>
            <h1 className="text-[28px] font-bold text-texto-forte">{rotulo}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Botao
              variante="secundario"
              aria-label={`Anterior: ${rotuloDaTemporada(anterior(temporada))}`}
              disabled={mesmaTemporada(temporada, primeira)}
              onClick={() => irPara(anterior(temporada))}
              icone={<Icone nome="esquerda" tamanho={16} />}
            >
              Anterior
            </Botao>
            <Botao variante="secundario" disabled={mesmaTemporada(temporada, atual)} onClick={() => irPara(atual)}>
              Atual
            </Botao>
            <Botao
              variante="secundario"
              aria-label={`Próxima: ${rotuloDaTemporada(proxima(temporada))}`}
              disabled={mesmaTemporada(temporada, ultima)}
              onClick={() => irPara(proxima(temporada))}
            >
              Próxima <Icone nome="direita" tamanho={16} />
            </Botao>
            <label className="flex items-center gap-2 text-[14px] text-texto-suave">
              <span className="sr-only">Temporada</span>
              <select
                aria-label="Temporada"
                value={chave(temporada)}
                onChange={(e) => {
                  const escolhida = opcoes.find((t) => chave(t) === e.target.value);
                  if (escolhida) irPara(escolhida);
                }}
                className="min-h-11 rounded-md border border-borda bg-superficie-alta px-3 text-[14px] text-texto-forte"
              >
                {opcoes.map((t) => (
                  <option key={chave(t)} value={chave(t)}>
                    {rotuloDaTemporada(t)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <Opcoes rotulo="Ordem" semLegenda opcoes={ORDENS} valor={ordem} mudar={mudarOrdem} />
      </header>
      <Conteudo animes={animes} rotulo={rotulo} naLista={naLista} />
    </div>
  );
}

type PropsConteudo = { animes: ReturnType<typeof useAnimesDaTemporada>; rotulo: string; naLista: Set<string> };

function Conteudo({ animes, rotulo, naLista }: PropsConteudo) {
  const { data, isPending, isError, error, refetch, isPlaceholderData } = animes;
  if (isPending) return <Carregando rotulo="Buscando animes" />;
  if (isError && !data) return <ErroTela erro={error} tentarDeNovo={() => void refetch()} />;
  if (!data) return null;
  if (data.length === 0) return <Vazio texto={`Nenhum anime de ${rotulo} no Catálogo.`} />;

  const { principal, filmesEEspeciais } = secoesDaTemporada(data);
  const grade = (rotuloDaGrade: string, itens: Midia[]) => (
    <ul aria-label={rotuloDaGrade} className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-x-4 gap-y-8">
      {itens.map((m) => (
        <li key={m.id_midia}>
          <CartaoDaTemporada anime={m} naLista={naLista.has(m.id_midia)} />
        </li>
      ))}
    </ul>
  );
  return (
    <div className={`flex flex-col gap-12 motion-safe:transition-opacity ${isPlaceholderData ? 'opacity-60' : ''}`}>
      {principal.length ? grade('Séries', principal) : null}
      {filmesEEspeciais.length ? (
        <section aria-label={TITULO_FILMES_E_ESPECIAIS}>
          <TituloSecao>{TITULO_FILMES_E_ESPECIAIS}</TituloSecao>
          {grade(TITULO_FILMES_E_ESPECIAIS, filmesEEspeciais)}
        </section>
      ) : null}
    </div>
  );
}

function Linha({ children }: { children: ReactNode }) {
  return <span className="text-[12px] text-texto-suave">{children}</span>;
}

/** Card A com estreia, estúdio e episódios; abaixo (fora do link), "Planejado" ou "Na Lista". */
function CartaoDaTemporada({ anime, naLista }: { anime: Midia; naLista: boolean }) {
  const planejar = usePorEmPlanejado();
  const estreia = formatarData(anime.data_lancamento);
  const selo = seloDeEstimativa(anime);
  const episodios = anime.numero_episodios;
  const detalhes = (
    <span className="flex flex-col gap-0.5">
      <NotasCartao midia={anime} />
      {estreia ? <Linha>Estreia {estreia}</Linha> : null}
      {anime.estudio ? <Linha>{anime.estudio}</Linha> : null}
      {episodios ? <Linha>{episodios === 1 ? '1 episódio' : `${episodios} episódios`}</Linha> : null}
      {selo ? (
        <span title={selo.explicacao} className="w-fit cursor-help text-[12px] italic text-texto-suave underline decoration-dotted">
          {selo.texto}
        </span>
      ) : null}
    </span>
  );
  return (
    <div className="flex flex-col gap-2">
      <CardA {...cartaoDaMidia(anime)} notas={detalhes} />
      {naLista ? (
        <span className="inline-flex min-h-9 items-center text-[13px] font-semibold text-texto-suave">Na Lista</span>
      ) : (
        <Botao
          variante="secundario"
          className="min-h-9 w-full"
          aria-label={`Pôr ${tituloDaMidia(anime)} em Planejado`}
          carregando={planejar.isPending}
          onClick={() => planejar.mutate({ idMidia: anime.id_midia, tipo: anime.tipo })}
          icone={<Icone nome="mais" tamanho={14} />}
        >
          Planejado
        </Botao>
      )}
      {planejar.isError ? (
        <p role="alert" className="text-[12px] text-erro">
          {mensagemDeErro(planejar.error)}
        </p>
      ) : null}
    </div>
  );
}

/** O atalho do Explorar e do Início: só nos catálogos com anime (quem chama decide). */
export function LinkTemporada({ className = '' }: { className?: string }) {
  const rotulo = rotuloDaTemporada(temporadaDe(new Date()));
  return (
    <Link
      to="/temporada"
      aria-label={`Temporada ${rotulo}`}
      className={`inline-flex min-h-9 w-fit items-center gap-1.5 rounded-full border border-borda px-3.5 text-[14px] font-semibold text-texto-forte hover:bg-superficie-alta ${className}`}
    >
      Temporada <span className="text-texto-suave">{rotulo}</span>
      <Icone nome="direita" tamanho={14} />
    </Link>
  );
}
