// PROTÓTIPO (ticket 39, Q118–Q121): os 4 eixos e os 2 liga/desliga, guardados na query
// string (?nav=B&formato=2&...), para mandar o link de uma combinação. Combinações que não
// cabem juntas degradam em `ajustar`, que também diz o que mudou.
import { useCallback, useEffect, useState } from 'react';

type Opcao = { chave: string; nome: string; porque: string };

export const EIXOS = {
  nav: {
    titulo: 'Navegação',
    padrao: 'B',
    opcoes: [
      { chave: 'A', nome: 'Abas', porque: 'Controle (hoje): um Status por vez; o resto fica escondido atrás das abas.' },
      { chave: 'B', nome: 'Seções empilhadas', porque: 'Tudo numa página, separada por Status com cabeçalho fixo; o índice salta e dá para recolher o que não interessa.' },
      { chave: 'C', nome: 'Coluna de Status', porque: 'Os Status ficam sempre à vista, com contagem; um clique troca sem perder a busca nem os filtros.' },
      { chave: 'D', nome: 'Fileiras', porque: 'Bom para achar de olho: o topo de cada Status numa fileira de capas; "Ver todos" abre o Status inteiro.' },
      { chave: 'E', nome: 'Quadro', porque: 'Mostra o fluxo (Planejado → Em progresso → Concluído) de uma vez; bom para gerir backlog, fraco para listas longas.' },
      { chave: 'F', nome: 'Lista única', porque: 'Uma ordem só para tudo; o Status vira filtro de chips múltiplos (ex.: Em progresso + Pausado) e um selo em cada linha.' },
    ],
  },
  formato: {
    titulo: 'Formato',
    padrao: '2',
    opcoes: [
      { chave: '1', nome: 'Card atual', porque: 'Controle (hoje): card de 104 px com banner, onde as horas ficam pequenas no canto.' },
      { chave: '2', nome: 'Linha compacta', porque: '56 px por Item com colunas alinhadas: dá para comparar nota e horas de cima a baixo.' },
      { chave: '3', nome: 'Grade de capas', porque: 'Acha pela capa; um selo grande de horas ou nota é o único texto sobre ela.' },
      { chave: '4', nome: 'Card médio', porque: 'Meio-termo: capa, título, gêneros e o fio carmesim largo, com horas e Progresso em destaque.' },
      { chave: '5', nome: 'Só texto', porque: 'O mais denso (32 px por Item): bom para listas de centenas; a capa aparece no hover.' },
      { chave: '6', nome: 'Mosaico', porque: 'Muitas capas numa tela só; detalhes no hover ou no foco, e no toque vira linha.' },
    ],
  },
  filtros: {
    titulo: 'Filtros',
    padrao: 'b',
    opcoes: [
      { chave: 'a', nome: 'Sheet', porque: 'Controle (hoje): a tela fica limpa, mas o filtro ativo fica escondido num painel.' },
      { chave: 'b', nome: 'Barra fixa', porque: 'Busca, Gênero, Situação e Ordem sempre à mão numa faixa fixa, com poucos filtros e diretos.' },
      { chave: 'c', nome: 'Coluna', porque: 'Como no Explorar: todos os filtros visíveis numa coluna; ocupa largura.' },
    ],
  },
  tamanho: {
    titulo: 'Tamanho',
    padrao: 'ii',
    opcoes: [
      { chave: 'i', nome: 'Tudo (virtual)', porque: 'Tudo na página sem pesar: só é desenhado o que aparece na tela.' },
      { chave: 'ii', nome: 'Prévia de 12', porque: 'Cada seção mostra os 12 primeiros na Ordem e "Ver todos (N)" expande: o que importa aparece primeiro.' },
      { chave: 'iii', nome: 'Páginas de 50', porque: 'Posição estável: dá para voltar ao mesmo ponto ("estava na página 3").' },
    ],
  },
} as const satisfies Record<string, { titulo: string; padrao: string; opcoes: readonly Opcao[] }>;

export const LIGA = {
  colunas: { titulo: 'Colunas ordenáveis', padrao: true, porque: 'Nas linhas, clicar no cabeçalho (Nota, Horas, Atualizado) troca a Ordem.' },
  az: { titulo: 'Índice A–Z', padrao: false, porque: 'Letras na lateral filtram pela inicial; funciona com qualquer Ordem e Tamanho.' },
} as const;

export type Eixo = keyof typeof EIXOS;
export type Liga = keyof typeof LIGA;
export type Valor<E extends Eixo> = (typeof EIXOS)[E]['opcoes'][number]['chave'];
export type Variantes = { [E in Eixo]: Valor<E> } & { [L in Liga]: boolean };

export const NOMES_EIXOS = Object.keys(EIXOS) as Eixo[];
export const NOMES_LIGA = Object.keys(LIGA) as Liga[];

export const PADRAO = {
  ...Object.fromEntries(NOMES_EIXOS.map((e) => [e, EIXOS[e].padrao])),
  ...Object.fromEntries(NOMES_LIGA.map((l) => [l, LIGA[l].padrao])),
} as Variantes;

function ler(): Variantes {
  const q = new URLSearchParams(location.search);
  const v: Record<string, string | boolean> = { ...PADRAO };
  for (const e of NOMES_EIXOS) {
    const x = q.get(e);
    if (x && EIXOS[e].opcoes.some((o) => o.chave === x)) v[e] = x;
  }
  for (const l of NOMES_LIGA) {
    const x = q.get(l);
    if (x === '1' || x === '0') v[l] = x === '1';
  }
  return v as Variantes;
}

/** Estado na URL (replaceState: trocar de variante não enche o histórico). */
export function useVariantes() {
  const [v, setV] = useState(ler);
  useEffect(() => {
    const voltar = () => setV(ler());
    addEventListener('popstate', voltar);
    return () => removeEventListener('popstate', voltar);
  }, []);
  const mudar = useCallback((parcial: Partial<Variantes>) => {
    setV((atual) => {
      const novo = { ...atual, ...parcial };
      const q = new URLSearchParams(location.search);
      for (const e of NOMES_EIXOS) q.set(e, novo[e]);
      for (const l of NOMES_LIGA) q.set(l, novo[l] ? '1' : '0');
      history.replaceState(null, '', `${location.pathname}?${q}`);
      return novo;
    });
  }, []);
  return [v, mudar] as const;
}

export const opcaoDe = <E extends Eixo>(e: E, chave: string) => EIXOS[e].opcoes.find((o) => o.chave === chave)!;

/** Formatos em linha (aceitam cabeçalhos de coluna). */
export const EM_LINHA = new Set(['2', '5']);

/**
 * Degradação das combinações que não cabem juntas. `formatoFileira` é o formato dentro
 * das fileiras (D), que só aceitam capas e cards; o escolhido vale no "Ver todos".
 */
export function ajustar(v: Variantes, toque: boolean) {
  const notas: string[] = [];
  let formato: string = v.formato;
  let tamanho: string = v.tamanho;
  let colunas = v.colunas;
  let filtros: string = v.filtros;
  let formatoFileira = formato;

  if (formato === '6' && toque) {
    formato = '2';
    notas.push('Toque sem hover: o mosaico vira linha compacta.');
  }
  if (v.nav === 'E') {
    if (formato === '6') {
      formato = '2';
      notas.push('Mosaico no quadro vira linha compacta (as colunas são estreitas para hover).');
    }
    if (tamanho === 'iii') {
      tamanho = 'ii';
      notas.push('Paginação por coluna do quadro não faz sentido: virou prévia de 12 por coluna.');
    }
    if (colunas && EM_LINHA.has(formato)) {
      colunas = false;
      notas.push('Sem cabeçalhos de coluna no quadro: a Ordem fica no controle de filtros.');
    }
    if (filtros === 'c') {
      filtros = 'b';
      notas.push('Coluna de filtros + quadro aperta as colunas: filtros foram para a barra fixa.');
    }
  }
  if (v.nav === 'D') {
    if (EM_LINHA.has(formato) || formato === '6') {
      formatoFileira = '3';
      notas.push(`Fileiras usam capas (${formato === '6' ? 'o hover do mosaico seria cortado' : 'linhas não rolam na horizontal'}); o formato escolhido vale no "Ver todos".`);
    }
    if (tamanho === 'ii') notas.push('Nas fileiras, a prévia de 12 é a própria fileira.');
  }
  if (v.nav === 'C' && filtros === 'c') {
    notas.push('Coluna de Status + coluna de filtros: viraram uma coluna só, filtros abaixo dos Status.');
  }
  if (colunas && !EM_LINHA.has(formato) && v.nav !== 'E') {
    notas.push('Cabeçalhos ordenáveis só existem nas linhas (2 e 5); aqui a Ordem fica nos filtros.');
  }
  return { nav: v.nav, formato, formatoFileira, tamanho, colunas: colunas && EM_LINHA.has(formato), filtros, az: v.az, notas };
}

export type Efetivo = ReturnType<typeof ajustar>;
