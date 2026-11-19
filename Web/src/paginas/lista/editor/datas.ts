import { formatarData } from '@dominio/datas';

/** "dd/mm/aaaa" do formulário → "aaaa-mm-dd" do <input type="date">. */
export function textoParaIso(texto: string): string {
  const [d, m, a] = texto.split('/');
  return texto ? `${a}-${m}-${d}` : '';
}

/** "aaaa-mm-dd" do <input type="date"> → "dd/mm/aaaa" do formulário; vazio se o campo foi limpo. */
export const isoParaTexto = (iso: string): string => formatarData(iso) ?? '';
