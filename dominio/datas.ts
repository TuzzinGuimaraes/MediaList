const MESES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const dois = (n: number) => String(n).padStart(2, '0');

/**
 * "dd/mm/aaaa" da data que a API manda, ou null se ausente ou ilegível. Aceita os dois
 * formatos que o backend produz: ISO 8601 ("2023-09-29", "2026-11-05T10:00:00"), dos
 * repositórios que serializam à mão, e RFC 1123 ("Fri, 06 Nov 2026 10:00:00 GMT"), do
 * `jsonify` do Flask com `datetime` cru. Lido à mão para não depender do parser de datas
 * do Hermes nem deslocar o dia pelo fuso: vale o dia do relógio do servidor.
 */
export function formatarData(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const rfc = /^\w{3}, (\d{2}) (\w{3}) (\d{4})/.exec(texto);
  if (rfc) {
    const mes = MESES.indexOf(rfc[2]);
    return mes < 0 ? null : `${rfc[1]}/${dois(mes + 1)}/${rfc[3]}`;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : null;
}

/** O dia local do aparelho em ISO ("2026-11-06"), sem passar pelo fuso UTC. */
export function diaIso(data: Date = new Date()): string {
  return `${data.getFullYear()}-${dois(data.getMonth() + 1)}-${dois(data.getDate())}`;
}

/** Data do calendário (dia local do aparelho) → "dd/mm/aaaa". */
export function textoDaData(data: Date): string {
  return `${dois(data.getDate())}/${dois(data.getMonth() + 1)}/${data.getFullYear()}`;
}

/** "dd/mm/aaaa" → Date à meia-noite local, para o calendário; null se vazio ou ilegível. */
export function dataDoTexto(texto: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  if (!m) return null;
  const data = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return textoDaData(data) === texto.trim() ? data : null;
}
