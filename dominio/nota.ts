// Escala das notas (CONTEXT.md: Avaliação, Nota pessoal, Nota da fonte): 0 a 10, com no
// máximo uma casa decimal, vírgula ou ponto. Cópia de Backend/dominio/nota.py, que segue
// autoritativo; aqui serve para o formulário recusar antes de enviar. 8,55 é recusado,
// não arredondado.

export const NOTA_MAXIMA = 10;

const NA_ESCALA = /^\d{1,2}([.,]\d)?$/;

/** A nota do texto digitado, ou null se ele não está na escala. */
export function lerNota(texto: string): number | null {
  const t = texto.trim();
  if (!NA_ESCALA.test(t)) return null;
  const nota = Number(t.replace(',', '.'));
  return nota <= NOTA_MAXIMA ? nota : null;
}
