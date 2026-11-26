// PROTÓTIPO (ticket 50), 2ª rodada: a aba "Calendário" da Temporada na proposta final, com e
// sem a faixa de dias (?variante=1|2), ?tela=celular limitando a 390 px e ?vista=agenda|semana
// (guardada no localStorage do protótipo). Abre sem login nem backend em /prototipo/calendario;
// dados fixos (episodios-prod.json), "agora" em ?agora= (padrão 2026-11-26T19:45:00Z) e fuso em
// ?fuso= (padrão America/Sao_Paulo). Planejado só em memória.
import { useMemo, useState } from 'react';

import { Barra } from './Barra';
import { Moldura, SemanaVazia } from './Comum';
import { type Acoes, AcoesCtx } from './contexto';
import { ehMeu, type Lista, LISTA_INICIAL, semana } from './dados';
import { Final } from './Final';
import { type Chave, type Tela, VARIANTES, type Vista } from './variantes';

const CHAVE_VISTA = 'prototipo-calendario:vista';

function daUrl(): { v: Chave; tela: Tela; vista: Vista } {
  const p = new URLSearchParams(location.search);
  const v = p.get('variante');
  const vista = p.get('vista') ?? localStorage.getItem(CHAVE_VISTA);
  return {
    v: VARIANTES.some((x) => x.chave === v) ? (v as Chave) : '1',
    tela: p.get('tela') === 'celular' ? 'celular' : 'desktop',
    vista: vista === 'semana' ? 'semana' : 'agenda',
  };
}

export function PrototipoCalendario() {
  const [{ v, tela, vista }, setUrl] = useState(daUrl);
  const [lista, setLista] = useState<Lista>(LISTA_INICIAL);
  // Ligado por padrão para quem tem algum dos seus em exibição.
  const [soOsMeus, setSoOsMeus] = useState(() => Object.values(LISTA_INICIAL).some(ehMeu));

  const mudar = (p: { v?: Chave; tela?: Tela; vista?: Vista }) => {
    const novo = { v: p.v ?? v, tela: p.tela ?? tela, vista: p.vista ?? vista };
    const q = new URLSearchParams(location.search);
    q.set('variante', novo.v);
    if (novo.tela === 'celular') q.set('tela', 'celular');
    else q.delete('tela');
    if (novo.vista === 'semana') q.set('vista', 'semana');
    else q.delete('vista');
    localStorage.setItem(CHAVE_VISTA, novo.vista);
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

  return (
    <AcoesCtx.Provider value={acoes}>
      <div className={tela === 'celular' ? 'min-h-screen bg-black/60' : ''}>
        <div className={`@container mx-auto bg-fundo ${tela === 'celular' ? 'max-w-[390px] shadow-2xl' : ''}`}>
          <Moldura>
            {vazia ? (
              <SemanaVazia />
            ) : (
              <Final key={`${v}-${vista}`} dias={dias} comFaixa={v === '1'} vista={vista} mudarVista={(x) => mudar({ vista: x })} />
            )}
          </Moldura>
        </div>
      </div>
      <Barra v={v} tela={tela} mudar={mudar} />
    </AcoesCtx.Provider>
  );
}
