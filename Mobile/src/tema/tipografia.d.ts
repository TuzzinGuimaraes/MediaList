type Nivel = { tamanho: number; altura: number };

declare const tipografia: {
  'titulo-tela': Nivel;
  'titulo-secao': Nivel;
  corpo: Nivel;
  legenda: Nivel;
  campo: { tamanho: number };
};
export = tipografia;
