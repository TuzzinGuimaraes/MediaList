// Coluna de filtros do Explorar: seções recolhíveis; quem guarda os valores é a URL.
import type { UseQueryResult } from '@tanstack/react-query';
import { type ReactNode, useId, useState } from 'react';

import { NOMES_TIPO, type TipoMidia } from '@dominio/estadoConsumo';
import { DEMOGRAFIAS, MODOS_DE_JOGO, type OpcaoDeFiltro, SITUACOES_DO_TIPO } from '@dominio/filtrosCatalogo';
import { rotuloMaisConcluidos } from '@dominio/inicio';

import { Icone } from '../../componentes/Icone';
import { Opcoes } from '../../componentes/Opcoes';
import { mensagemDeErro } from '../../api/erros';
import { ANO_MAXIMO, ANO_MINIMO, anosInvertidos, type BuscaExplorar, ORDEM_PADRAO, type OrdemExplorar } from './busca';
import { CampoAtrasado } from './CampoAtrasado';

/** Gêneros visíveis antes do "+N". */
export const GENEROS_VISIVEIS = 8;

/** Valor das pílulas "Todos"/"Todas" (as pílulas só aceitam texto). */
const TODOS = '';

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

/** Seção recolhível; fechada, mostra o valor escolhido ao lado do título. */
function Secao({ titulo, resumo, children }: { titulo: string; resumo?: string | null; children: ReactNode }) {
  const [aberta, setAberta] = useState(true);
  const id = useId();
  return (
    <section aria-label={titulo} className="border-b border-borda py-3">
      <h2>
        <button
          type="button"
          aria-expanded={aberta}
          aria-controls={id}
          onClick={() => setAberta((a) => !a)}
          className="flex min-h-9 w-full items-center gap-2 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-marca-texto"
        >
          <span className="text-[13px] font-semibold tracking-wide text-texto-suave uppercase">{titulo}</span>
          {!aberta && resumo ? <span className="truncate text-[13px] text-marca-texto">{resumo}</span> : null}
          <Icone
            nome="baixo"
            tamanho={16}
            className={`ml-auto text-texto-suave motion-safe:transition-transform ${aberta ? 'rotate-180' : ''}`}
          />
        </button>
      </h2>
      <div id={id} hidden={!aberta} className="pt-2">
        {children}
      </div>
    </section>
  );
}

/** Pílulas com as primeiras visíveis e um "+N" que mostra o resto; a escolhida nunca some. */
function PilulasLimitadas({
  rotulo,
  opcoes,
  valor,
  mudar,
  todos,
}: {
  rotulo: string;
  opcoes: string[];
  valor?: string;
  mudar(valor: string | undefined): void;
  todos: string;
}) {
  const [tudo, setTudo] = useState(false);
  const base = tudo ? opcoes : opcoes.slice(0, GENEROS_VISIVEIS);
  const visiveis = valor && !base.includes(valor) ? [...base, valor] : base;
  const resto = opcoes.length - GENEROS_VISIVEIS;
  return (
    <Opcoes
      rotulo={rotulo}
      semLegenda
      opcoes={[{ valor: TODOS, nome: todos }, ...visiveis.map((g) => ({ valor: g, nome: g }))]}
      valor={valor ?? TODOS}
      mudar={(v) => mudar(v || undefined)}
      depois={
        resto > 0 ? (
          <button
            type="button"
            aria-expanded={tudo}
            aria-label={tudo ? `Mostrar menos ${rotulo.toLowerCase()}s` : `Mostrar mais ${resto} ${rotulo.toLowerCase()}s`}
            onClick={() => setTudo((t) => !t)}
            className="inline-flex min-h-9 items-center rounded-full border border-dashed border-borda px-3.5 text-[14px] font-semibold text-marca-texto outline-none hover:border-marca-texto focus-visible:ring-2 focus-visible:ring-marca-texto"
          >
            {tudo ? 'Menos' : `+${resto}`}
          </button>
        ) : null
      }
    />
  );
}

function PilulasComTodos({
  rotulo,
  opcoes,
  valor,
  mudar,
  todos,
}: {
  rotulo: string;
  opcoes: OpcaoDeFiltro[];
  valor?: string;
  mudar(valor: string | undefined): void;
  todos: string;
}) {
  return (
    <Opcoes
      rotulo={rotulo}
      semLegenda
      opcoes={[{ valor: TODOS, nome: todos }, ...opcoes]}
      valor={valor ?? TODOS}
      mudar={(v) => mudar(v || undefined)}
    />
  );
}

const ESTILO_CAMPO =
  'w-full rounded-md border border-borda bg-superficie-alta px-3 py-2 text-[14px] text-texto-forte outline-none placeholder:text-texto-suave focus:border-marca-texto';

const anoValido = (v: string) => v === '' || (/^\d+$/.test(v) && Number(v) >= ANO_MINIMO && Number(v) <= ANO_MAXIMO);
const paraAno = (v: string) => (v ? Number(v) : undefined);

function Anos({ busca, mudar }: { busca: BuscaExplorar; mudar: Mudar }) {
  const erro = anosInvertidos(busca);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <CampoAtrasado
          aria-label="Ano inicial"
          placeholder="De"
          inputMode="numeric"
          valor={busca.ano_min?.toString() ?? ''}
          aceitar={anoValido}
          mudar={(v) => mudar({ ano_min: paraAno(v) })}
          aria-invalid={erro || undefined}
          className={ESTILO_CAMPO}
        />
        <span className="text-texto-suave">a</span>
        <CampoAtrasado
          aria-label="Ano final"
          placeholder="Até"
          inputMode="numeric"
          valor={busca.ano_max?.toString() ?? ''}
          aceitar={anoValido}
          mudar={(v) => mudar({ ano_max: paraAno(v) })}
          aria-invalid={erro || undefined}
          className={ESTILO_CAMPO}
        />
      </div>
      {erro ? (
        <p role="alert" className="text-[13px] text-erro">
          O ano inicial passa do final.
        </p>
      ) : null}
    </div>
  );
}

export type Mudar = (parcial: Partial<BuscaExplorar>) => void;

type Props = {
  busca: BuscaExplorar;
  tipo: TipoMidia;
  tipos: readonly TipoMidia[];
  generos: UseQueryResult<string[]>;
  mudar: Mudar;
  trocarTipo(tipo: TipoMidia): void;
};

export function Filtros({ busca, tipo, tipos, generos, mudar, trocarTipo }: Props) {
  const situacoes = SITUACOES_DO_TIPO[tipo];
  const opcoesOrdem = ordens(tipo);
  const resumoAno =
    busca.ano_min !== undefined || busca.ano_max !== undefined ? `${busca.ano_min ?? '…'} a ${busca.ano_max ?? '…'}` : null;
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
        {generos.isError && !generos.data ? (
          <p className="text-[13px] text-texto-suave">
            {mensagemDeErro(generos.error)}{' '}
            <button type="button" onClick={() => void generos.refetch()} className="text-marca-texto hover:underline">
              Tentar de novo
            </button>
          </p>
        ) : (
          <PilulasLimitadas
            key={tipo}
            rotulo="Gênero"
            opcoes={generos.data ?? []}
            valor={busca.genero}
            mudar={(genero) => mudar({ genero })}
            todos="Todos"
          />
        )}
      </Secao>
      <Secao titulo="Situação" resumo={nomeEm(situacoes, busca.situacao)}>
        <PilulasComTodos
          rotulo="Situação"
          opcoes={situacoes}
          valor={busca.situacao}
          mudar={(situacao) => mudar({ situacao })}
          todos="Todas"
        />
      </Secao>
      {tipo === 'jogo' ? (
        <>
          <Secao titulo="Plataforma" resumo={busca.plataforma}>
            <CampoAtrasado
              aria-label="Plataforma"
              aria-describedby="dica-plataforma"
              placeholder="Ex.: PC, PS5, Switch"
              valor={busca.plataforma ?? ''}
              mudar={(v) => mudar({ plataforma: v || undefined })}
              className={ESTILO_CAMPO}
            />
            <p id="dica-plataforma" className="mt-1.5 text-[12px] text-texto-suave">
              O nome da plataforma, inteiro.
            </p>
          </Secao>
          <Secao titulo="Modo de jogo" resumo={nomeEm(MODOS_DE_JOGO, busca.modo_jogo)}>
            <PilulasComTodos
              rotulo="Modo de jogo"
              opcoes={MODOS_DE_JOGO}
              valor={busca.modo_jogo}
              mudar={(v) => mudar({ modo_jogo: v as BuscaExplorar['modo_jogo'] })}
              todos="Todos"
            />
          </Secao>
        </>
      ) : null}
      {tipo === 'anime' ? (
        <Secao titulo="Estúdio" resumo={busca.estudio}>
          <CampoAtrasado
            aria-label="Estúdio"
            placeholder="Ex.: Madhouse"
            valor={busca.estudio ?? ''}
            mudar={(v) => mudar({ estudio: v || undefined })}
            className={ESTILO_CAMPO}
          />
        </Secao>
      ) : null}
      {tipo === 'manga' ? (
        <Secao titulo="Demografia" resumo={nomeEm(DEMOGRAFIAS, busca.demografia)}>
          <PilulasComTodos
            rotulo="Demografia"
            opcoes={DEMOGRAFIAS}
            valor={busca.demografia}
            mudar={(v) => mudar({ demografia: v as BuscaExplorar['demografia'] })}
            todos="Todas"
          />
        </Secao>
      ) : null}
      <Secao titulo="Ano" resumo={resumoAno}>
        <Anos busca={busca} mudar={mudar} />
      </Secao>
      <Secao titulo="Ordem" resumo={nomeEm(opcoesOrdem, busca.ordem ?? ORDEM_PADRAO)}>
        <Opcoes
          rotulo="Ordem"
          semLegenda
          opcoes={opcoesOrdem}
          valor={busca.ordem ?? ORDEM_PADRAO}
          mudar={(ordem) => mudar({ ordem })}
        />
      </Secao>
    </div>
  );
}
