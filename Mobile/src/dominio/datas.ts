const MESES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const dois = (n: number) => String(n).padStart(2, '0');

/**
 * "dd/mm/aaaa" da data que a API manda. O Flask serializa `datetime` em RFC 1123
 * ("Fri, 06 Nov 2026 10:00:00 GMT"); lido à mão para não depender do parser de datas
 * do Hermes. O dia é o do relógio do servidor, sem conversão de fuso.
 */
export function formatarData(texto: string): string {
  const rfc = /^\w{3}, (\d{2}) (\w{3}) (\d{4})/.exec(texto);
  if (rfc) {
    const mes = MESES.indexOf(rfc[2]);
    return mes < 0 ? '' : `${rfc[1]}/${dois(mes + 1)}/${rfc[3]}`;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : '';
}
