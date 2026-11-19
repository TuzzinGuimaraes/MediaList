// Textos da tela Minha Lista.
export const textos = {
  titulo: 'Minha Lista',
  itens: (n: number) => (n === 1 ? '1 Item' : `${n} Itens`),
  abas: 'Status da Lista',
  buscar: 'Buscar na Lista',
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
