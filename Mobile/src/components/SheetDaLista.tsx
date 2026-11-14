import { View } from 'react-native';

import { FILTROS_PADRAO, type FiltrosLista, type OpcoesDosFiltros, type OrdemLista } from '../dominio/filtrosLista';
import { GrupoFiltro, SheetFiltros } from './SheetFiltros';

const textos = {
  genero: 'Gênero',
  situacao: 'Situação',
  ordem: 'Ordem',
  todos: 'Todos',
  todas: 'Todas',
};

const ORDENS: { valor: OrdemLista; titulo: string }[] = [
  { valor: 'titulo', titulo: 'Alfabética' },
  { valor: 'nota', titulo: 'Nota pessoal' },
  { valor: 'adicao', titulo: 'Adicionado recentemente' },
  { valor: 'atualizacao', titulo: 'Atualizado recentemente' },
];

type Props = {
  filtros: FiltrosLista;
  opcoes: OpcoesDosFiltros;
  mudar(filtros: FiltrosLista): void;
  aoFechar(): void;
};

/** Sheet de filtros da Lista: Gênero e Situação (só os que existem nos Itens) e Ordem. */
export function SheetDaLista({ filtros, opcoes, mudar, aoFechar }: Props) {
  return (
    <SheetFiltros aoFechar={aoFechar} limpar={() => mudar(FILTROS_PADRAO)}>
      <View className="gap-5">
        {opcoes.generos.length ? (
          <GrupoFiltro
            rotulo={textos.genero}
            opcoes={[{ valor: null, titulo: textos.todos }, ...opcoes.generos.map((g) => ({ valor: g, titulo: g }))]}
            valor={filtros.genero}
            escolher={(genero) => mudar({ ...filtros, genero })}
          />
        ) : null}
        {opcoes.situacoes.length ? (
          <GrupoFiltro<string | null>
            rotulo={textos.situacao}
            opcoes={[{ valor: null, titulo: textos.todas }, ...opcoes.situacoes]}
            valor={filtros.situacao}
            escolher={(situacao) => mudar({ ...filtros, situacao })}
          />
        ) : null}
        <GrupoFiltro rotulo={textos.ordem} opcoes={ORDENS} valor={filtros.ordem} escolher={(ordem) => mudar({ ...filtros, ordem })} />
      </View>
    </SheetFiltros>
  );
}
