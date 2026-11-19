// Categorias de Notícia que o admin escolhe ao publicar. O backend aceita qualquer texto e
// usa "geral" sem categoria; esta é a lista que os clientes oferecem.

export const CATEGORIAS_NOTICIA = [
  { valor: 'geral', nome: 'Geral' },
  { valor: 'lancamento', nome: 'Lançamento' },
  { valor: 'temporada', nome: 'Nova temporada' },
  { valor: 'evento', nome: 'Evento' },
  { valor: 'manga', nome: 'Mangá' },
  { valor: 'filme', nome: 'Filme' },
  { valor: 'anuncio', nome: 'Anúncio' },
] as const;

export type CategoriaNoticia = (typeof CATEGORIAS_NOTICIA)[number]['valor'];
