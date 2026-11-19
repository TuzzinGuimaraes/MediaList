// Estatísticas da Lista pessoal por Tipo de mídia, nos Tipos do catálogo escolhido (como no
// web antigo). GET /usuario/estatisticas dá os totais por Tipo; Status, notas, Gêneros e
// plataformas saem dos Itens da Lista, porque a rota não os separa.
import { useState } from 'react';

import {
  APRESENTACAO_DO_TIPO,
  contarPorEstado,
  ESTADOS,
  NOMES_ESTADO,
  NOMES_TIPO,
  rotuloPara,
  type TipoMidia,
} from '@dominio/estadoConsumo';
import { distribuicaoDeNotas, formatarMedia, maisFrequentes, plataformasDoItem } from '@dominio/estatisticas';

import type { Esquemas } from '../api/tipos';
import { Barras } from '../componentes/Barras';
import { Opcoes } from '../componentes/Opcoes';
import { COR_DO_ESTADO } from '../componentes/status';
import { useCatalogo } from '../catalogo/CatalogoContext';

const MAX_TERMOS = 8;

type Props = {
  itens: readonly Esquemas['ItemLista'][];
  porTipo: readonly Esquemas['EstatisticaPorTipo'][];
};

function Numero({ rotulo, valor }: { rotulo: string; valor: string | number }) {
  return (
    <div className="flex flex-col rounded-lg bg-superficie-alta px-4 py-3">
      <span className="text-[22px] font-bold text-texto-forte">{valor}</span>
      <span className="text-[13px] text-texto-suave">{rotulo}</span>
    </div>
  );
}

function DoTipo({ tipo, itens, linha }: { tipo: TipoMidia; itens: Props['itens']; linha?: Esquemas['EstatisticaPorTipo'] }) {
  const doTipo = itens.filter((i) => i.tipo === tipo);
  const contagem = contarPorEstado(doTipo);
  const status = ESTADOS.filter((e) => rotuloPara(e, tipo)).map((e) => ({
    rotulo: NOMES_ESTADO[e],
    valor: contagem[e],
    refinamento: e === 'platinado',
    cor: COR_DO_ESTADO[e],
  }));
  const notas = distribuicaoDeNotas(doTipo).map((f) => ({ rotulo: `Nota ${f.nota}`, valor: f.total }));
  const generos = maisFrequentes(doTipo.map((i) => i.generos_lista), MAX_TERMOS).map((g) => ({ rotulo: g.nome, valor: g.total }));
  const plataformas =
    tipo === 'jogo'
      ? maisFrequentes(doTipo.map(plataformasDoItem), MAX_TERMOS).map((p) => ({ rotulo: p.nome, valor: p.total }))
      : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Numero rotulo="Na Lista" valor={linha?.total_midias ?? doTipo.length} />
        <Numero rotulo="Favoritos" valor={linha?.favoritos ?? 0} />
        <Numero rotulo="Média das notas" valor={formatarMedia(linha?.nota_media)} />
        <Numero rotulo={APRESENTACAO_DO_TIPO[tipo].progresso} valor={linha?.progresso_total_consumido ?? 0} />
      </div>
      <div className="grid gap-8 md:grid-cols-2">
        <Barras titulo="Por Status" barras={status} />
        <Barras titulo="Distribuição das notas" barras={notas} />
        {generos.length ? <Barras titulo="Gêneros mais frequentes" barras={generos} /> : null}
        {plataformas.length ? <Barras titulo="Plataformas" barras={plataformas} /> : null}
      </div>
    </div>
  );
}

export function EstatisticasPerfil({ itens, porTipo }: Props) {
  const { tipos } = useCatalogo();
  const [escolhido, setEscolhido] = useState<TipoMidia | null>(null);
  const tipo = escolhido && tipos.includes(escolhido) ? escolhido : tipos[0]!;

  return (
    <div className="flex flex-col gap-5">
      {tipos.length > 1 ? (
        <Opcoes<TipoMidia>
          rotulo="Tipo de mídia"
          semLegenda
          opcoes={tipos.map((t) => ({ valor: t, nome: NOMES_TIPO[t] }))}
          valor={tipo}
          mudar={setEscolhido}
        />
      ) : null}
      <DoTipo tipo={tipo} itens={itens} linha={porTipo.find((l) => l.tipo === tipo)} />
    </div>
  );
}
