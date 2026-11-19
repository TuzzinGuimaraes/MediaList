import { emLancamento, nomeDaSituacao, situacaoDe } from './situacao';

const semStatus = { status_anime: null, status_manga: null, status_jogo: null };

describe('Situação (status de lançamento)', () => {
  it('lê o campo do Tipo da Mídia', () => {
    expect(situacaoDe({ ...semStatus, tipo: 'anime', status_anime: 'em_exibicao' })).toBe('em_exibicao');
    expect(situacaoDe({ ...semStatus, tipo: 'manga', status_manga: 'hiato' })).toBe('hiato');
    expect(situacaoDe({ ...semStatus, tipo: 'jogo', status_jogo: 'lancado', status_anime: 'finalizado' })).toBe('lancado');
  });

  it('sem o campo (ex.: listagem de populares), não há Situação', () => {
    expect(situacaoDe({ tipo: 'anime' })).toBeNull();
  });

  it('dá o nome legível; valor desconhecido passa como veio', () => {
    expect(nomeDaSituacao('em_exibicao')).toBe('Em exibição');
    expect(nomeDaSituacao('hiato')).toBe('Em hiato');
    expect(nomeDaSituacao('lancado')).toBe('Lançado');
    expect(nomeDaSituacao('novo_status')).toBe('novo_status');
  });

  it('"em lançamento" só para anime em exibição e mangá em publicação', () => {
    expect(emLancamento({ ...semStatus, tipo: 'anime', status_anime: 'em_exibicao' })).toBe('Em exibição');
    expect(emLancamento({ ...semStatus, tipo: 'manga', status_manga: 'em_publicacao' })).toBe('Em publicação');
    expect(emLancamento({ ...semStatus, tipo: 'anime', status_anime: 'finalizado' })).toBeNull();
    expect(emLancamento({ ...semStatus, tipo: 'jogo', status_jogo: 'em_desenvolvimento' })).toBeNull();
    expect(emLancamento({ tipo: 'manga' })).toBeNull();
  });
});
