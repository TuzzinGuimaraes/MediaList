// Escala tipográfica única do app (ticket 12). Fonte para o tailwind.config.js
// (classes text-titulo-tela, text-titulo-secao, text-corpo, text-legenda, text-campo)
// e para o que precisa de tamanho em JS (cabeçalho e barra de abas).
// Tamanhos em pt; o ajuste de fonte do sistema multiplica todos eles.
// CommonJS porque o Tailwind lê este arquivo no Node.
module.exports = {
  /** Título da tela (Login, Criar conta, número em destaque). */
  'titulo-tela': { tamanho: 28, altura: 36 },
  /** Título de seção, de card de notícia, de sheet/modal e da Mídia no detalhe. */
  'titulo-secao': { tamanho: 20, altura: 28 },
  /** Texto corrido, valores, botões, chips e itens de menu. */
  corpo: { tamanho: 16, altura: 24 },
  /** Rótulos, metadados, cabeçalhos em caixa alta, selos e pílulas. Nunca abaixo de 13. */
  legenda: { tamanho: 14, altura: 20 },
  /** Texto digitado em TextInput: tamanho do corpo, sem altura de linha (que desalinha o campo). */
  campo: { tamanho: 16 },
};
