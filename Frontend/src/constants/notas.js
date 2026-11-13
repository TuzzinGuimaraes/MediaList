// Notas de uma Mídia (CONTEXT.md: Nota média, Nota da fonte, Nota pessoal).
// A Nota média é a das Avaliações e chega null sem elas; a Nota da fonte é a do
// AniList ou da RAWG, gravada pela Importação. Cada uma aparece com o seu rótulo.

export const ROTULO_NOTA_MEDIA = 'Nota dos Usuários';

export const MENSAGEM_ESCALA = 'A nota vai de 0 a 10, com no máximo uma casa decimal.';

const comUmaCasa = (nota) => Number(nota).toFixed(1);

/** [{ rotulo, valor, daFonte }] das notas que a Mídia tem; vazio sem nenhuma. */
export function notasDaMidia(midia) {
    const notas = [];
    if (midia.nota_media != null) {
        notas.push({ rotulo: ROTULO_NOTA_MEDIA, valor: comUmaCasa(midia.nota_media), daFonte: false });
    }
    if (midia.nota_fonte != null) {
        const rotulo = midia.origem_nota ? `Nota ${midia.origem_nota}` : 'Nota da fonte';
        notas.push({ rotulo, valor: comUmaCasa(midia.nota_fonte), daFonte: true });
    }
    return notas;
}

const NA_ESCALA = /^\d{1,2}([.,]\d)?$/;

/**
 * Nota digitada na escala (0 a 10, no máximo uma casa, vírgula ou ponto), ou null.
 * 8,55 é recusada, não arredondada: o backend também a recusa.
 */
export function lerNota(texto) {
    const t = String(texto ?? '').trim();
    if (!NA_ESCALA.test(t)) return null;
    const nota = Number(t.replace(',', '.'));
    return nota <= 10 ? nota : null;
}
