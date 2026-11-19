import { DEMOGRAFIAS, MODOS_DE_JOGO, SITUACOES_DO_TIPO } from './filtrosCatalogo';

describe('filtros do Catálogo', () => {
  it('cada Tipo tem as Situações do banco, com o nome da tela', () => {
    expect(SITUACOES_DO_TIPO.anime).toEqual([
      { valor: 'em_exibicao', nome: 'Em exibição' },
      { valor: 'finalizado', nome: 'Finalizado' },
      { valor: 'aguardando', nome: 'Aguardando' },
      { valor: 'cancelado', nome: 'Cancelado' },
    ]);
    expect(SITUACOES_DO_TIPO.manga.map((s) => s.valor)).toEqual([
      'em_publicacao',
      'finalizado',
      'aguardando',
      'hiato',
      'cancelado',
    ]);
    expect(SITUACOES_DO_TIPO.jogo.map((s) => s.nome)).toEqual(['Lançado', 'Em desenvolvimento', 'Remasterizado', 'Cancelado']);
  });

  it('Modos de jogo e Demografias têm nome na tela', () => {
    expect(MODOS_DE_JOGO).toEqual([
      { valor: 'single', nome: 'Um jogador' },
      { valor: 'multi', nome: 'Multijogador' },
      { valor: 'ambos', nome: 'Os dois' },
    ]);
    expect(DEMOGRAFIAS.map((d) => d.nome)).toEqual(['Shounen', 'Shoujo', 'Seinen', 'Josei', 'Kodomomuke']);
  });
});
