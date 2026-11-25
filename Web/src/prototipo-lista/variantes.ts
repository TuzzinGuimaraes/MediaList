// PROTÓTIPO (ticket 39, 2ª rodada): o que sobrou do veredito de 2026-11-25. Navegação C,
// filtros c e tamanho i ficaram fixos; restam o Formato (3/2/5) e onde fica o Tipo
// (lateral/topo). Estado na URL (para mandar um link); o Formato também no localStorage,
// como será no produto (o alternador da tela e a barra mexem no mesmo estado).
import { useCallback, useEffect, useState } from 'react';

type Opcao = { chave: string; nome: string; porque: string };

export const EIXOS = {
  formato: {
    titulo: 'Formato',
    padrao: '3',
    opcoes: [
      { chave: '3', nome: 'Grade de capas', porque: 'Padrão: acha pela capa; nota, nome e Progresso/horas dentro do card.' },
      { chave: '2', nome: 'Linha compacta', porque: 'Preferência: capa pequena e colunas ordenáveis; destaque no hover ou foco.' },
      { chave: '5', nome: 'Só texto', porque: 'Preferência: o mais denso, colunas ordenáveis; destaque no hover ou foco.' },
    ],
  },
  tipo: {
    titulo: 'Tipo',
    padrao: 'lateral',
    opcoes: [
      { chave: 'lateral', nome: 'Na coluna', porque: 'O Tipo fica na coluna lateral, entre a busca e os Status.' },
      { chave: 'topo', nome: 'No topo', porque: 'O Tipo volta ao segmentado no topo fixo, como na 1ª rodada.' },
    ],
  },
} as const satisfies Record<string, { titulo: string; padrao: string; opcoes: readonly Opcao[] }>;

export type Eixo = keyof typeof EIXOS;
export type Valor<E extends Eixo> = (typeof EIXOS)[E]['opcoes'][number]['chave'];
export type Variantes = { [E in Eixo]: Valor<E> };
export type Formato = Valor<'formato'>;

export const NOMES_EIXOS = Object.keys(EIXOS) as Eixo[];
export const PADRAO = Object.fromEntries(NOMES_EIXOS.map((e) => [e, EIXOS[e].padrao])) as Variantes;

const CHAVE_FORMATO = 'prototipo-lista.formato';
const valido = (e: Eixo, x: string | null) => !!x && EIXOS[e].opcoes.some((o) => o.chave === x);

/** URL primeiro (link de combinação); sem ela, o Formato salvo; sem nada, o padrão. */
function ler(): Variantes {
  const q = new URLSearchParams(location.search);
  const v: Record<string, string> = { ...PADRAO };
  const salvo = localStorage.getItem(CHAVE_FORMATO);
  if (valido('formato', salvo)) v.formato = salvo!;
  for (const e of NOMES_EIXOS) {
    const x = q.get(e);
    if (valido(e, x)) v[e] = x!;
  }
  return v as Variantes;
}

function gravar(v: Variantes) {
  localStorage.setItem(CHAVE_FORMATO, v.formato);
  const q = new URLSearchParams(location.search);
  for (const e of NOMES_EIXOS) q.set(e, v[e]);
  // replaceState: trocar de variante não enche o histórico.
  history.replaceState(null, '', `${location.pathname}?${q}`);
}

export function useVariantes() {
  const [v, setV] = useState(ler);
  useEffect(() => gravar(v), [v]);
  useEffect(() => {
    const voltar = () => setV(ler());
    addEventListener('popstate', voltar);
    return () => removeEventListener('popstate', voltar);
  }, []);
  const mudar = useCallback((parcial: Partial<Variantes>) => setV((atual) => ({ ...atual, ...parcial })), []);
  return [v, mudar] as const;
}

export const opcaoDe = <E extends Eixo>(e: E, chave: string) => EIXOS[e].opcoes.find((o) => o.chave === chave)!;
