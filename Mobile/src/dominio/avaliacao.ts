import type { DadosAvaliacao } from '../api/tipos';

// Validação local do formulário de Avaliação. A faixa é a que o banco grava de fato:
// `avaliacoes.nota` é DECIMAL(3,2) (máximo 9,99) e a rota recusa nota 0. Uma nota 10
// passa pelo CHECK, estoura o DECIMAL e o backend responde 201 sem gravar nada.

export const NOTA_MINIMA = 0.01;
export const NOTA_MAXIMA = 9.99;
export const TITULO_MAXIMO = 200;

export type FormularioAvaliacao = { nota: string; titulo: string; texto: string };

export type ResultadoValidacao = { ok: true; dados: DadosAvaliacao } | { ok: false; erro: string };

export function validarAvaliacao(f: FormularioAvaliacao): ResultadoValidacao {
  const textoNota = f.nota.trim().replace(',', '.');
  const nota = Number(textoNota);
  if (!textoNota || Number.isNaN(nota)) return { ok: false, erro: 'Informe a nota.' };
  if (nota < NOTA_MINIMA || nota > NOTA_MAXIMA) {
    return { ok: false, erro: 'A nota vai de 0,01 a 9,99.' };
  }
  const titulo = f.titulo.trim();
  if (titulo.length > TITULO_MAXIMO) {
    return { ok: false, erro: `O título tem no máximo ${TITULO_MAXIMO} caracteres.` };
  }
  const texto = f.texto.trim();
  return {
    ok: true,
    dados: { nota, titulo_avaliacao: titulo || null, texto_avaliacao: texto || null },
  };
}
