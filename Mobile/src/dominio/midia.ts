import type { Midia, MidiaResumo, NotasDaMidia } from '../api/tipos';

export function tituloDaMidia(midia: Pick<MidiaResumo, 'titulo_portugues' | 'titulo_original'>): string {
  return midia.titulo_portugues || midia.titulo_original;
}

/**
 * O título que o detalhe mostra em texto suave abaixo do principal: o primeiro entre o
 * original e o inglês que for diferente do principal; null se nenhum for.
 */
export function tituloAlternativo(
  midia: Pick<Midia, 'titulo_portugues' | 'titulo_original' | 'titulo_ingles'>,
): string | null {
  const principal = tituloDaMidia(midia);
  return [midia.titulo_original, midia.titulo_ingles].find((t) => t && t !== principal) ?? null;
}

/** Uma nota pronta para a tela: rótulo inteiro (detalhe, leitor de tela) e curto (card). */
export type NotaExibida = { rotulo: string; curto: string; valor: string };

/** Rótulo da Nota média na tela. */
export const ROTULO_NOTA_MEDIA = 'Nota dos Usuários';

const comUmaCasa = (nota: number) => nota.toFixed(1);

/**
 * As notas que a Mídia mostra (CONTEXT.md: Nota média, Nota da fonte), cada uma com o seu
 * rótulo: a Nota média ("Nota dos Usuários") só existe com Avaliações, e o backend a manda
 * null sem elas; a Nota da fonte leva o nome da fonte ("Nota AniList", "Nota RAWG").
 * Sem nenhuma das duas, lista vazia.
 */
export function notasDaMidia(midia: NotasDaMidia): NotaExibida[] {
  const notas: NotaExibida[] = [];
  if (midia.nota_media != null) {
    notas.push({ rotulo: ROTULO_NOTA_MEDIA, curto: 'Usuários', valor: comUmaCasa(midia.nota_media) });
  }
  if (midia.nota_fonte != null) {
    const fonte = midia.origem_nota;
    notas.push({
      rotulo: fonte ? `Nota ${fonte}` : 'Nota da fonte',
      curto: fonte ?? 'Fonte',
      valor: comUmaCasa(midia.nota_fonte),
    });
  }
  return notas;
}

/** "Mais bem avaliadas": a Nota média, senão a Nota da fonte (mesma regra do backend). */
export function notaDeRanking(midia: Pick<NotasDaMidia, 'nota_media' | 'nota_fonte'>): number | null {
  return midia.nota_media ?? midia.nota_fonte ?? null;
}

type Atributo = [rotulo: string, valor: string | number | null];

/** Atributos específicos do Tipo de mídia; os vazios ficam de fora. O status de lançamento aparece como
 * "Situação", porque "Status" na tela é o Estado de consumo. */
export function atributosDoTipo(midia: Midia): [string, string][] {
  const porTipo: Record<Midia['tipo'], Atributo[]> = {
    anime: [
      ['Episódios', midia.numero_episodios],
      ['Situação', midia.status_anime],
      ['Estúdio', midia.estudio],
    ],
    manga: [
      ['Capítulos', midia.numero_capitulos],
      ['Volumes', midia.numero_volumes],
      ['Situação', midia.status_manga],
      ['Autor', midia.autor],
      ['Demografia', midia.demografia],
    ],
    jogo: [
      ['Plataformas', midia.plataformas],
      ['Situação', midia.status_jogo],
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
