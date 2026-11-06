import type { Midia, MidiaResumo } from '../api/tipos';

export function tituloDaMidia(midia: Pick<MidiaResumo, 'titulo_portugues' | 'titulo_original'>): string {
  return midia.titulo_portugues || midia.titulo_original;
}

/**
 * A Nota média deriva só de Avaliações. A Importação grava em `nota_media` a nota da
 * fonte externa, então sem Avaliações não há Nota média a mostrar, venha o que vier.
 */
export function notaMedia(midia: Pick<Midia, 'nota_media' | 'total_avaliacoes'>): string | null {
  if (!midia.total_avaliacoes || midia.nota_media == null) return null;
  return Number(midia.nota_media).toFixed(1);
}

type Atributo = [rotulo: string, valor: string | number | null];

/** Atributos específicos do Tipo de mídia; os vazios ficam de fora. */
export function atributosDoTipo(midia: Midia): [string, string][] {
  const porTipo: Record<Midia['tipo'], Atributo[]> = {
    anime: [
      ['Episódios', midia.numero_episodios],
      ['Status', midia.status_anime],
      ['Estúdio', midia.estudio],
    ],
    manga: [
      ['Capítulos', midia.numero_capitulos],
      ['Volumes', midia.numero_volumes],
      ['Status', midia.status_manga],
      ['Autor', midia.autor],
      ['Demografia', midia.demografia],
    ],
    jogo: [
      ['Plataformas', midia.plataformas],
      ['Status', midia.status_jogo],
      ['Desenvolvedor', midia.desenvolvedor],
      ['Publicadora', midia.publicadora],
    ],
  };
  return (porTipo[midia.tipo] ?? [])
    .filter(([, valor]) => valor != null && valor !== '')
    .map(([rotulo, valor]) => [rotulo, String(valor)]);
}

/** Quantas Avaliações caíram em cada nota inteira de 1 a 10 (arredondada). */
export function distribuicaoDeNotas(notas: number[]): { nota: number; total: number }[] {
  const totais = Array.from({ length: 10 }, (_, i) => ({ nota: i + 1, total: 0 }));
  for (const n of notas) {
    const nota = Math.round(Number(n));
    if (nota >= 1 && nota <= 10) totais[nota - 1].total++;
  }
  return totais;
}
