import { juntarCarrossel } from './carrossel';

const midia = (id: string, campos: Partial<Record<string, unknown>> = {}) => ({
  id_midia: id,
  nota_media: null,
  nota_fonte: null,
  data_lancamento: null,
  total_usuarios: 0,
  total_concluidos: 0,
  ...campos,
});

describe('juntarCarrossel', () => {
  it('junta as respostas dos Tipos do Recorte pela nota de ranking, maior primeiro', () => {
    const animes = [midia('A1', { nota_media: 9 }), midia('A2', { nota_media: 7 })];
    const mangas = [midia('M1', { nota_media: 8 }), midia('M2', { nota_fonte: 8.5 })];

    expect(juntarCarrossel([animes, mangas], 'nota_media').map((m) => m.id_midia)).toEqual(['A1', 'M2', 'M1', 'A2']);
  });

  it('pela data de lançamento, a mais recente primeiro e sem data no fim', () => {
    const animes = [midia('A1', { data_lancamento: '2024-01-10' }), midia('A2')];
    const mangas = [midia('M1', { data_lancamento: '2025-03-01' })];

    expect(juntarCarrossel([animes, mangas], 'data_lancamento').map((m) => m.id_midia)).toEqual(['M1', 'A1', 'A2']);
  });

  it('por mais adicionados e por mais concluídos, pelos totais', () => {
    const animes = [midia('A1', { total_usuarios: 3, total_concluidos: 9 })];
    const mangas = [midia('M1', { total_usuarios: 5, total_concluidos: 1 })];

    expect(juntarCarrossel([animes, mangas], 'mais_adicionados').map((m) => m.id_midia)).toEqual(['M1', 'A1']);
    expect(juntarCarrossel([animes, mangas], 'mais_concluidos').map((m) => m.id_midia)).toEqual(['A1', 'M1']);
  });

  it('corta no limite', () => {
    const animes = [midia('A1', { nota_media: 9 }), midia('A2', { nota_media: 8 }), midia('A3', { nota_media: 7 })];

    expect(juntarCarrossel([animes], 'nota_media', 2).map((m) => m.id_midia)).toEqual(['A1', 'A2']);
  });
});
