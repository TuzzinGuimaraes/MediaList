// Textos da tela Minha Lista.
import type { OrdemLista, TipoDaLista } from '@dominio/filtrosLista';
import { temProgresso, totalDoItem } from '@dominio/itemLista';

import type { ItemLista } from './api';

const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/** "2,5", "142", "1.020". */
export const formatarNumero = (n: number) => numero.format(n);

export const textos = {
  titulo: 'Minha Lista',
  itens: (n: number) => (n === 1 ? '1 Item' : `${n} Itens`),
  horasEmJogos: 'em jogos',
  notaMedia: (media: number) => `nota média ${formatarNumero(media)}`,
  coluna: 'Busca, Status e filtros',
  buscar: 'Buscar na Lista',
  limparBusca: 'Limpar busca',
  tipo: 'Tipo',
  status: 'Status',
  todos: 'Todos',
  genero: 'Gênero',
  situacao: 'Situação',
  maisGeneros: (n: number) => `+${n}`,
  menosGeneros: 'Menos',
  limparFiltros: 'Limpar filtros',
  ordem: 'Ordem',
  direcao: (subindo: boolean) => `Direção: ${subindo ? 'crescente' : 'decrescente'}. Inverter`,
  inverter: 'Inverter a direção',
  com: (termo: string) => ` com “${termo}”`,
  menuStatus: (titulo: string, status: string) => `Status de ${titulo}: ${status}. Mudar`,
  vazia: 'Sua Lista ainda está vazia.',
  explorar: 'Explorar o catálogo',
  nadaNoStatus: (status: string, termo: string) => `Nada em ${status} com “${termo}”.`,
  verEmTodos: (n: number) => `Ver ${n} em Todos`,
  nadaComBusca: (termo: string) => `Nada na Lista com “${termo}”.`,
  nadaComFiltros: 'Nada na Lista com esses filtros.',
  limparBuscaEFiltros: 'Limpar busca e filtros',
  // Lista antiga (abas, sheet, cards), até o ticket 03 removê-la.
  abas: 'Status da Lista',
  campoBusca: 'Buscar em todos os Status',
  fecharBusca: 'Fechar busca',
  filtros: 'Filtros',
  filtrosAtivos: (n: number) => `Filtros, ${n} ativo${n === 1 ? '' : 's'}`,
  resultados: (n: number, termo: string) =>
    `${n === 1 ? '1 resultado' : `${n} resultados`} para “${termo}” em todos os Status`,
  semResultado: 'Nada na Lista com esse título.',
  vazio: (estado: string) => `Nenhum Item em ${estado}.`,
  vazioFiltrado: (estado: string) => `Nenhum Item em ${estado} com esses filtros.`,
  sugestoes: 'Sugestões para você',
};

/** O Tipo na coluna e nas subseções do "Todos". */
export const NOMES_TIPO_DA_LISTA: Record<TipoDaLista, string> = { todos: 'Todos', anime: 'Anime', manga: 'Mangá', jogo: 'Jogos' };

/** Nome da Ordem no seletor; o padrão e as horas dizem o que valem para o Tipo escolhido. */
export function nomeDaOrdem(ordem: OrdemLista, tipo: TipoDaLista): string {
  switch (ordem) {
    case 'padrao':
      return tipo === 'jogo' ? 'Padrão (mais horas)' : tipo === 'todos' ? 'Padrão (nota; horas nos jogos)' : 'Padrão (maior nota)';
    case 'horas':
      return tipo === 'jogo' ? 'Horas' : tipo === 'todos' ? 'Horas / Progresso' : 'Progresso';
    case 'nota':
      return 'Nota pessoal';
    case 'titulo':
      return 'Título';
    case 'adicao':
      return 'Adicionado';
    case 'atualizacao':
      return 'Atualizado';
  }
}

/** "12/24" (ou "12" sem total) no anime/mangá; "148 h" no jogo, null sem horas. */
export function textoDoConsumo(item: ItemLista): string | null {
  if (!temProgresso(item.tipo)) return item.progresso_atual ? `${formatarNumero(item.progresso_atual)} h` : null;
  const total = totalDoItem(item);
  const atual = item.progresso_atual ?? 0;
  return total !== null ? `${atual}/${total}` : `${atual}`;
}
