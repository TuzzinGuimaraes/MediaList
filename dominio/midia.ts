import type { Midia, NotasDaMidia } from './tipos';
import { nomeDaSituacao, situacaoDe } from './situacao';

/** Os títulos de uma Mídia (CONTEXT.md: Título). */
export type TitulosDaMidia = Pick<Midia, 'titulo_ingles' | 'titulo_romaji' | 'titulo_original'>;

/**
 * O título exibido da Mídia (CONTEXT.md: Título): o inglês, senão o romanizado, senão o original;
 * vazio conta como ausente. Mesma regra do `titulo_exibido` do backend.
 */
export function tituloDaMidia(midia: TitulosDaMidia): string {
  return midia.titulo_ingles || midia.titulo_romaji || midia.titulo_original;
}

/** "nenhum episódio", "1 episódio", "3 episódios". */
export function contagemDeEpisodios(n: number): string {
  if (n === 0) return 'nenhum episódio';
  return n === 1 ? '1 episódio' : `${n} episódios`;
}

/** Os outros títulos que o Detalhe mostra abaixo do título exibido: o romanizado e o original,
 * nessa ordem, sem os vazios e sem repetir o exibido nem um ao outro. O inglês nunca entra: se
 * existe, é o exibido. */
export function outrosTitulos(midia: TitulosDaMidia): string[] {
  const exibido = tituloDaMidia(midia);
  const outros = [midia.titulo_romaji, midia.titulo_original].filter((t): t is string => !!t && t !== exibido);
  return [...new Set(outros)];
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

/** Nomes na tela das Demografias (o enum da API vem em minúsculas). */
const NOMES_DEMOGRAFIA: Record<NonNullable<Midia['demografia']>, string> = {
  shounen: 'Shounen',
  shoujo: 'Shoujo',
  seinen: 'Seinen',
  josei: 'Josei',
  kodomomuke: 'Kodomomuke',
};

/** Atributos específicos do Tipo de mídia; os vazios ficam de fora. O status de lançamento aparece como
 * "Situação", com o nome legível, porque "Status" na tela é o Estado de consumo. */
export function atributosDoTipo(midia: Midia): [string, string][] {
  const situacao = situacaoDe(midia);
  const nomeSituacao = situacao && nomeDaSituacao(situacao);
  const porTipo: Record<Midia['tipo'], Atributo[]> = {
    anime: [
      ['Episódios', midia.numero_episodios],
      ['Situação', nomeSituacao],
      ['Estúdio', midia.estudio],
    ],
    manga: [
      ['Capítulos', midia.numero_capitulos],
      ['Volumes', midia.numero_volumes],
      ['Situação', nomeSituacao],
      ['Autor', midia.autor],
      ['Demografia', midia.demografia && NOMES_DEMOGRAFIA[midia.demografia]],
    ],
    jogo: [
      ['Plataformas', midia.plataformas],
      ['Situação', nomeSituacao],
      ['Desenvolvedor', midia.desenvolvedor],
      ['Publicadora', midia.publicadora],
    ],
  };
  return (porTipo[midia.tipo] ?? [])
    .filter(([, valor]) => valor != null && valor !== '')
    .map(([rotulo, valor]) => [rotulo, String(valor)]);
}
