// Seletor de destaques do Perfil (spec `conquistas-steam`, ticket 04): "Escolher destaques" abre um
// modal com todas as conquistas obtidas do Usuário, com busca pelo nome, filtro por jogo, "Só as
// destacadas" e a ordem (raridade ou data), em páginas de 50 com "Carregar mais". Destacar e tirar
// usam a mesma escrita da lista do Detalhe, que relê o seletor, os destaques e a lista do Item.
import { useId, useState } from 'react';

import {
  FILTROS_INICIAIS_DO_SELETOR,
  type FiltrosDoSeletor,
  ORDENS_DO_SELETOR,
  TEXTOS_DAS_CONQUISTAS,
} from '@dominio/conquistas';

import { Botao } from '../componentes/Botao';
import { Modal } from '../componentes/Camada';
import { Carregando, FalhaParcial, Vazio } from '../componentes/Estados';
import { Icone } from '../componentes/Icone';
import { Opcoes } from '../componentes/Opcoes';
import { BotaoDeDestaque, LinhaDaConquista } from './detalhe/Conquistas';
import { useConquistasDoSeletor, useJogosComConquistas } from './destaques';
import { CampoAtrasado } from './explorar/CampoAtrasado';

const ORDENS = ORDENS_DO_SELETOR.map((o) => ({ valor: o.valor, nome: o.rotulo }));

/** O botão "Escolher destaques" e o modal do seletor (montado só aberto: fechar zera os filtros). */
export function EscolherDestaques() {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Botao variante="secundario" onClick={() => setAberto(true)} className="self-start">
        {TEXTOS_DAS_CONQUISTAS.escolherDestaques}
      </Botao>
      <Modal titulo={TEXTOS_DAS_CONQUISTAS.escolherDestaques} aberto={aberto} fechar={() => setAberto(false)}>
        {aberto ? <Seletor /> : null}
      </Modal>
    </>
  );
}

function Seletor() {
  const [filtros, setFiltros] = useState<FiltrosDoSeletor>(FILTROS_INICIAIS_DO_SELETOR);
  const mudar = (parte: Partial<FiltrosDoSeletor>) => setFiltros((atual) => ({ ...atual, ...parte }));
  return (
    <div className="flex flex-col gap-4">
      <Filtros filtros={filtros} mudar={mudar} />
      <Resultados filtros={filtros} />
    </div>
  );
}

function Filtros({ filtros, mudar }: { filtros: FiltrosDoSeletor; mudar(parte: Partial<FiltrosDoSeletor>): void }) {
  const jogos = useJogosComConquistas();
  const idJogo = useId();
  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 rounded-md border border-borda bg-superficie-alta px-3 focus-within:border-marca-texto">
        <Icone nome="busca" tamanho={16} className="text-texto-suave" />
        <CampoAtrasado
          type="search"
          aria-label={TEXTOS_DAS_CONQUISTAS.buscar}
          placeholder={TEXTOS_DAS_CONQUISTAS.buscar}
          valor={filtros.busca}
          mudar={(busca) => mudar({ busca })}
          className="min-h-10 w-full bg-transparent text-[14px] text-texto-forte outline-none placeholder:text-texto-suave"
        />
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-48 flex-1 flex-col gap-1.5">
          <label htmlFor={idJogo} className="text-[13px] font-semibold text-texto-suave">
            {TEXTOS_DAS_CONQUISTAS.jogo}
          </label>
          <select
            id={idJogo}
            value={filtros.steamAppid ?? ''}
            onChange={(e) => mudar({ steamAppid: e.target.value ? Number(e.target.value) : null })}
            className="h-10 rounded-md border border-borda bg-superficie-alta px-3 text-[14px] text-texto-forte outline-none focus:border-marca-texto"
          >
            <option value="">{TEXTOS_DAS_CONQUISTAS.todosOsJogos}</option>
            {(jogos.data ?? []).map((j) => (
              <option key={j.steam_appid} value={j.steam_appid}>
                {j.jogo}
              </option>
            ))}
          </select>
        </div>
        <label className="flex min-h-10 cursor-pointer items-center gap-2 text-[14px] text-texto-forte">
          <input
            type="checkbox"
            checked={filtros.soDestacadas}
            onChange={(e) => mudar({ soDestacadas: e.target.checked })}
            className="h-4 w-4 accent-marca"
          />
          {TEXTOS_DAS_CONQUISTAS.soDestacadas}
        </label>
      </div>
      <Opcoes
        rotulo={TEXTOS_DAS_CONQUISTAS.ordenarPor}
        opcoes={ORDENS}
        valor={filtros.ordem}
        mudar={(ordem) => mudar({ ordem })}
      />
    </div>
  );
}

function Resultados({ filtros }: { filtros: FiltrosDoSeletor }) {
  const conquistas = useConquistasDoSeletor(filtros);
  if (conquistas.isError && !conquistas.data) {
    return <FalhaParcial erro={conquistas.error} tentarDeNovo={() => void conquistas.refetch()} />;
  }
  if (!conquistas.data) return <Carregando />;
  if (!conquistas.data.length) return <Vazio texto={TEXTOS_DAS_CONQUISTAS.nenhumaNoSeletor} />;
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-borda">
        {conquistas.data.map((c) => (
          <LinhaDaConquista
            key={`${c.id_lista}/${c.codigo}`}
            conquista={c}
            jogo={c.jogo}
            comJogo
            acao={<BotaoDeDestaque conquista={c} />}
          />
        ))}
      </ul>
      {conquistas.hasNextPage ? (
        <Botao
          variante="secundario"
          carregando={conquistas.isFetchingNextPage}
          onClick={() => void conquistas.fetchNextPage()}
          className="self-center"
        >
          {TEXTOS_DAS_CONQUISTAS.carregarMais}
        </Botao>
      ) : null}
    </div>
  );
}
