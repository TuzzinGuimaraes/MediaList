// Sheet de filtros da Lista (Resolution do 34): Ordem, Situação e Gênero (só os que existem
// nos Itens do catálogo). Muda na hora; vale para todos os Status.
import { FILTROS_PADRAO, type FiltrosLista, type OpcoesDosFiltros, type OrdemLista } from '@dominio/filtrosLista';

import { Botao } from '../componentes/Botao';
import { Sheet } from '../componentes/Camada';
import { Opcoes } from '../componentes/Opcoes';

const ORDENS: { valor: OrdemLista; nome: string }[] = [
  { valor: 'titulo', nome: 'Alfabética' },
  { valor: 'nota', nome: 'Nota pessoal' },
  { valor: 'adicao', nome: 'Adicionado recentemente' },
  { valor: 'atualizacao', nome: 'Atualizado recentemente' },
];

/** As pílulas trabalham com texto: '' é "todos". */
const TODOS = '';

type Props = {
  aberto: boolean;
  fechar(): void;
  filtros: FiltrosLista;
  opcoes: OpcoesDosFiltros;
  mudar(filtros: FiltrosLista): void;
};

export function FiltrosDaLista({ aberto, fechar, filtros, opcoes, mudar }: Props) {
  return (
    <Sheet
      titulo="Filtros da Lista"
      aberto={aberto}
      fechar={fechar}
      rodape={
        <>
          <Botao variante="fantasma" onClick={() => mudar(FILTROS_PADRAO)}>
            Limpar filtros
          </Botao>
          <Botao onClick={fechar}>Ver Itens</Botao>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <Opcoes rotulo="Ordem" opcoes={ORDENS} valor={filtros.ordem} mudar={(ordem) => mudar({ ...filtros, ordem })} />
        {opcoes.situacoes.length ? (
          <Opcoes
            rotulo="Situação"
            opcoes={[{ valor: TODOS, nome: 'Todas' }, ...opcoes.situacoes.map((s) => ({ valor: s.valor, nome: s.titulo }))]}
            valor={filtros.situacao ?? TODOS}
            mudar={(s) => mudar({ ...filtros, situacao: s || null })}
          />
        ) : null}
        {opcoes.generos.length ? (
          <Opcoes
            rotulo="Gênero"
            opcoes={[{ valor: TODOS, nome: 'Todos' }, ...opcoes.generos.map((g) => ({ valor: g, nome: g }))]}
            valor={filtros.genero ?? TODOS}
            mudar={(g) => mudar({ ...filtros, genero: g || null })}
          />
        ) : null}
      </div>
    </Sheet>
  );
}
