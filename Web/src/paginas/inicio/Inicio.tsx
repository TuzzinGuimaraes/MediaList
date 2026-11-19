// Início (Resolution do 29): destaques de Em alta e, abaixo, nesta ordem: Continuar, Em alta,
// Top 10, Maiores notas, Lançamentos recentes, até 2 "Porque você curte <gênero>", Mais
// adicionados e Mais concluídos. Fileira vazia some; tudo segue o catálogo escolhido.
import type { ReactNode } from 'react';

import { estadoDe } from '@dominio/estadoConsumo';
import { foraDe, generosQueVoceCurte, jaLancadas, rotuloMaisConcluidos } from '@dominio/inicio';

import type { Esquemas } from '../../api/tipos';
import { useCatalogo } from '../../catalogo/CatalogoContext';
import { Carregando, ErroTela, Vazio } from '../../componentes/Estados';
import { Fileira } from '../../componentes/Fileira';
import { ALTURA_NAV } from '../../layout/Casca';
import { CartaoCatalogo, CartaoContinuar, CartaoTop } from './cartoes';
import { useEditorItem } from '../lista/EditorItemContext';
import { useLista } from '../lista/api';
import { useCarrosseisPorGenero, useCarrossel, useEmAlta, usePopulares } from './consultas';
import { Destaques } from './Destaques';

type ItemLista = Esquemas['ItemLista'];
type MidiaDoCarrossel = Esquemas['Midia'] | Esquemas['MidiaPopular'];

const MAX_DESTAQUES = 5;

const textos = {
  vazio: 'Nenhuma Mídia neste catálogo ainda.',
  continuar: 'Continuar',
  emAlta: 'Em alta',
  // Populares é acumulado (Usuários com a Mídia na Lista), não do dia: sem o "de hoje".
  top10: 'Top 10',
  maioresNotas: 'Maiores notas',
  lancamentos: 'Lançamentos recentes',
  porGenero: (genero: string) => `Porque você curte ${genero}`,
  maisAdicionados: 'Mais adicionados',
};

/** Tela sob a nav (sem destaque): carregando, vazio e erro. */
function SobANav({ children }: { children: ReactNode }) {
  return <div style={{ paddingTop: ALTURA_NAV }}>{children}</div>;
}

export function Inicio() {
  const { recorte, tipos } = useCatalogo();
  const emAlta = useEmAlta(recorte);
  const populares = usePopulares(recorte);
  const lista = useLista();
  const maioresNotas = useCarrossel(recorte, 'nota_media');
  const lancamentos = useCarrossel(recorte, 'data_lancamento');
  const maisAdicionados = useCarrossel(recorte, 'mais_adicionados');
  const maisConcluidos = useCarrossel(recorte, 'mais_concluidos');
  const { abrirEditor } = useEditorItem();

  // Sem a Lista (ainda carregando), os gêneros esperam: senão sairiam os das populares e trocariam.
  const itens: ItemLista[] | undefined = lista.data ?? (lista.isError ? [] : undefined);
  const itensDoCatalogo = itens?.filter((i) => tipos.includes(i.tipo));
  const generos = itensDoCatalogo && populares.data ? generosQueVoceCurte(itensDoCatalogo, populares.data) : [];
  const porGenero = useCarrosseisPorGenero(recorte, generos);

  if (emAlta.isError || populares.isError) {
    const tentarDeNovo = () => {
      void emAlta.refetch();
      void populares.refetch();
    };
    return (
      <SobANav>
        <ErroTela erro={emAlta.error ?? populares.error} tentarDeNovo={tentarDeNovo} />
      </SobANav>
    );
  }
  if (!emAlta.data || !populares.data) {
    return (
      <SobANav>
        <Carregando />
      </SobANav>
    );
  }

  const top10 = populares.data.slice(0, 10);
  const posicaoTop = (id: string) => {
    const i = top10.findIndex((m) => m.id_midia === id);
    return i >= 0 ? i + 1 : null;
  };
  const itemDe = (id: string) => itens?.find((i) => i.id_midia === id);
  const continuar = (itensDoCatalogo ?? []).filter((i) => estadoDe(i.status_consumo, i.tipo) === 'em_progresso');
  const carrosseis = [
    { titulo: textos.maioresNotas, midias: foraDe(maioresNotas.data, emAlta.data) },
    { titulo: textos.lancamentos, midias: jaLancadas(lancamentos.data ?? []) },
    ...generos.map((g, i) => ({ titulo: textos.porGenero(g), midias: foraDe(porGenero[i]?.data, itens) })),
    { titulo: textos.maisAdicionados, midias: foraDe(maisAdicionados.data, top10) },
    { titulo: rotuloMaisConcluidos(tipos), midias: maisConcluidos.data ?? [] },
  ];

  // O vazio da tela só quando todas as fileiras (já respondidas) vierem vazias.
  const pendente = [lista, maioresNotas, lancamentos, maisAdicionados, maisConcluidos, ...porGenero].some((c) => c.isPending);
  const vazio = !pendente && [emAlta.data, top10, continuar, ...carrosseis.map((c) => c.midias)].every((l) => !l.length);
  if (vazio) {
    return (
      <SobANav>
        <Vazio texto={textos.vazio} />
      </SobANav>
    );
  }

  const linha = (titulo: string, midias: MidiaDoCarrossel[]) => (
    <Fileira key={titulo} titulo={titulo} vazia={!midias.length}>
      {midias.map((m) => (
        <CartaoCatalogo key={m.id_midia} midia={m} item={itemDe(m.id_midia)} posicaoTop={posicaoTop(m.id_midia)} />
      ))}
    </Fileira>
  );

  return (
    <div className="pb-24">
      <h1 className="sr-only">Início</h1>
      <Destaques midias={emAlta.data.slice(0, MAX_DESTAQUES)} itens={itens} posicaoTop={posicaoTop} abrirEditor={abrirEditor} />
      {/* Sobe um pouco sobre o destaque: o Continuar fica visível sem rolar num 1080p. */}
      <div className="relative z-10 -mt-4 flex flex-col gap-9">
        <Fileira titulo={textos.continuar} vazia={!continuar.length}>
          {continuar.map((i) => (
            <CartaoContinuar key={i.id_lista} item={i} posicaoTop={posicaoTop(i.id_midia)} />
          ))}
        </Fileira>
        {linha(textos.emAlta, emAlta.data)}
        <Fileira titulo={textos.top10} vazia={!top10.length}>
          {top10.map((m, i) => (
            <CartaoTop key={m.id_midia} midia={m} posicao={i + 1} item={itemDe(m.id_midia)} posicaoTop={null} />
          ))}
        </Fileira>
        {carrosseis.map((c) => linha(c.titulo, c.midias))}
      </div>
    </div>
  );
}
