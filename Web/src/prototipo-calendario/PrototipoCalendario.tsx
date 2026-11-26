// PROTÓTIPO (ticket 50): a aba "Calendário" da Temporada em 4 variantes estruturais, trocadas
// por ?variante=A..D, com ?tela=celular limitando a 390 px. Abre sem login nem backend em
// /prototipo/calendario; dados fixos (episodios-prod.json), "agora" em ?agora= (padrão
// 2026-11-26T19:45:00Z) e fuso em ?fuso= (padrão America/Sao_Paulo). Planejado só em memória.
import { useMemo, useState } from 'react';

import { Barra } from './Barra';
import { Moldura, SemanaVazia } from './Comum';
import { type Acoes, AcoesCtx } from './contexto';
import { ehMeu, type Lista, LISTA_INICIAL, semana } from './dados';
import { VarianteA } from './VarianteA';
import { VarianteB } from './VarianteB';
import { VarianteC } from './VarianteC';
import { VarianteD } from './VarianteD';
import { type Chave, type Tela, VARIANTES } from './variantes';

function daUrl(): { v: Chave; tela: Tela } {
  const p = new URLSearchParams(location.search);
  const v = p.get('variante')?.toUpperCase();
  return {
    v: VARIANTES.some((x) => x.chave === v) ? (v as Chave) : 'A',
    tela: p.get('tela') === 'celular' ? 'celular' : 'desktop',
  };
}

export function PrototipoCalendario() {
  const [{ v, tela }, setUrl] = useState(daUrl);
  const [lista, setLista] = useState<Lista>(LISTA_INICIAL);
  // Ligado por padrão para quem tem algum dos seus em exibição.
  const [soOsMeus, setSoOsMeus] = useState(() => Object.values(LISTA_INICIAL).some(ehMeu));

  const mudar = (p: { v?: Chave; tela?: Tela }) => {
    const novo = { v: p.v ?? v, tela: p.tela ?? tela };
    const q = new URLSearchParams(location.search);
    q.set('variante', novo.v);
    if (novo.tela === 'celular') q.set('tela', 'celular');
    else q.delete('tela');
    history.replaceState(null, '', `${location.pathname}?${q}`);
    setUrl(novo);
  };

  const acoes: Acoes = useMemo(
    () => ({
      lista,
      soOsMeus,
      mudarFiltro: setSoOsMeus,
      planejar: (id) => setLista((l) => ({ ...l, [id]: { estado: 'planejado', favorito: false } })),
      abrir: (e) => alert(`PROTÓTIPO: abriria o Detalhe de "${e.titulo}"`),
    }),
    [lista, soOsMeus],
  );

  const dias = semana(lista, soOsMeus);
  const vazia = dias.every((d) => d.episodios.length === 0);
  const Variante = { A: VarianteA, B: VarianteB, C: VarianteC, D: VarianteD }[v];

  return (
    <AcoesCtx.Provider value={acoes}>
      <div className={tela === 'celular' ? 'min-h-screen bg-black/60' : ''}>
        <div className={`@container mx-auto bg-fundo ${tela === 'celular' ? 'max-w-[390px] shadow-2xl' : ''}`}>
          <Moldura>{vazia ? <SemanaVazia /> : <Variante key={v} dias={dias} />}</Moldura>
        </div>
      </div>
      <Barra v={v} tela={tela} mudar={mudar} />
    </AcoesCtx.Provider>
  );
}
