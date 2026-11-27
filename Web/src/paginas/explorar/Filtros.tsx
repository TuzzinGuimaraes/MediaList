// Coluna de filtros do Explorar: seções recolhíveis; quem guarda os valores é a URL.
import type { UseQueryResult } from '@tanstack/react-query';

import { NOMES_TIPO, type TipoMidia } from '@dominio/estadoConsumo';
import { DEMOGRAFIAS, MODOS_DE_JOGO, type OpcaoDeFiltro, SITUACOES_DO_TIPO } from '@dominio/filtrosCatalogo';
import { rotuloMaisConcluidos } from '@dominio/inicio';

import type { Esquemas } from '../../api/tipos';
import { Opcoes } from '../../componentes/Opcoes';
import { OpcoesComTodos } from '../../componentes/OpcoesComTodos';
import { type BuscaExplorar, ordemMarcada, type OrdemExplorar, resumoDoAno } from './busca';
import { Anos } from './filtros/Anos';
import { PilulasDaApi } from './filtros/PilulasLimitadas';
import { Secao } from './filtros/Secao';

function ordens(tipo: TipoMidia): OpcaoDeFiltro<OrdemExplorar>[] {
  return [
    { valor: 'nota_media', nome: 'Maiores notas' },
    { valor: 'mais_adicionados', nome: 'Mais adicionados' },
    { valor: 'mais_concluidos', nome: rotuloMaisConcluidos([tipo]) },
    { valor: 'data_lancamento', nome: 'Mais recentes' },
    { valor: 'titulo', nome: 'Título (A–Z)' },
  ];
}

const nomeEm = (opcoes: OpcaoDeFiltro[], valor?: string) => opcoes.find((o) => o.valor === valor)?.nome;

export type Mudar = (parcial: Partial<BuscaExplorar>) => void;

type Props = {
  busca: BuscaExplorar;
  tipo: TipoMidia;
  tipos: readonly TipoMidia[];
  generos: UseQueryResult<string[]>;
  facetas: UseQueryResult<Esquemas['RespostaFacetas']>;
  mudar: Mudar;
  trocarTipo(tipo: TipoMidia): void;
};

export function Filtros({ busca, tipo, tipos, generos, facetas, mudar, trocarTipo }: Props) {
  const situacoes = SITUACOES_DO_TIPO[tipo];
  const opcoesOrdem = ordens(tipo);
  return (
    <div className="flex flex-col">
      {tipos.length > 1 ? (
        <Secao titulo="Tipo" resumo={NOMES_TIPO[tipo]}>
          <Opcoes
            rotulo="Tipo"
            semLegenda
            opcoes={tipos.map((t) => ({ valor: t, nome: NOMES_TIPO[t] }))}
            valor={tipo}
            mudar={trocarTipo}
          />
        </Secao>
      ) : null}
      <Secao titulo="Gênero" resumo={busca.genero}>
        <PilulasDaApi
          key={tipo}
          consulta={generos}
          opcoes={(g) => g}
          rotulo="Gênero"
          plural="gêneros"
          valor={busca.genero}
          mudar={(genero) => mudar({ genero })}
          todos="Todos"
        />
      </Secao>
      <Secao titulo="Situação" resumo={nomeEm(situacoes, busca.situacao)}>
        <OpcoesComTodos
          rotulo="Situação"
          semLegenda
          todos="Todas"
          opcoes={situacoes}
          valor={busca.situacao}
          mudar={(situacao) => mudar({ situacao })}
        />
      </Secao>
      {tipo === 'jogo' ? (
        <>
          <Secao titulo="Plataforma" resumo={busca.plataforma}>
            <PilulasDaApi
              consulta={facetas}
              opcoes={(f) => f.plataformas}
              rotulo="Plataforma"
              plural="plataformas"
              valor={busca.plataforma}
              mudar={(plataforma) => mudar({ plataforma })}
              todos="Todas"
            />
          </Secao>
          <Secao titulo="Modo de jogo" resumo={nomeEm(MODOS_DE_JOGO, busca.modo_jogo)}>
            <OpcoesComTodos
              rotulo="Modo de jogo"
              semLegenda
              opcoes={MODOS_DE_JOGO}
              valor={busca.modo_jogo}
              mudar={(v) => mudar({ modo_jogo: v as BuscaExplorar['modo_jogo'] })}
            />
          </Secao>
        </>
      ) : null}
      {tipo === 'anime' ? (
        <Secao titulo="Estúdio" resumo={busca.estudio}>
          <PilulasDaApi
            consulta={facetas}
            opcoes={(f) => f.estudios}
            rotulo="Estúdio"
            plural="estúdios"
            valor={busca.estudio}
            mudar={(estudio) => mudar({ estudio })}
            todos="Todos"
          />
        </Secao>
      ) : null}
      {tipo === 'manga' ? (
        <Secao titulo="Demografia" resumo={nomeEm(DEMOGRAFIAS, busca.demografia)}>
          <OpcoesComTodos
            rotulo="Demografia"
            semLegenda
            todos="Todas"
            opcoes={DEMOGRAFIAS}
            valor={busca.demografia}
            mudar={(v) => mudar({ demografia: v as BuscaExplorar['demografia'] })}
          />
        </Secao>
      ) : null}
      <Secao titulo="Ano" resumo={resumoDoAno(busca)}>
        <Anos busca={busca} mudar={mudar} />
      </Secao>
      <Secao titulo="Ordem" resumo={nomeEm(opcoesOrdem, ordemMarcada(busca)) ?? 'Relevância'}>
        <Opcoes
          rotulo="Ordem"
          semLegenda
          opcoes={opcoesOrdem}
          valor={ordemMarcada(busca)}
          mudar={(ordem) => mudar({ ordem })}
        />
      </Secao>
    </div>
  );
}
