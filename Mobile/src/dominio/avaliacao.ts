import type { DadosAvaliacao } from '../api/tipos';
import { lerNota } from './nota';

// Validação local do formulário de Avaliação. A escala da nota (0 a 10, uma casa) é a do
// domínio, em `./nota`; o backend recusa o resto com 400.

export const TITULO_MAXIMO = 200;

export type FormularioAvaliacao = { nota: string; titulo: string; texto: string };

export type ResultadoValidacao = { ok: true; dados: DadosAvaliacao } | { ok: false; erro: string };

export function validarAvaliacao(f: FormularioAvaliacao): ResultadoValidacao {
  const textoNota = f.nota.trim().replace(',', '.');
  if (!textoNota || Number.isNaN(Number(textoNota))) return { ok: false, erro: 'Informe a nota.' };
  const nota = lerNota(f.nota);
  if (nota === null) {
    return { ok: false, erro: 'A nota vai de 0 a 10, com no máximo uma casa decimal.' };
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
