import { totalDoItem } from './itemLista';

describe('totalDoItem', () => {
    it('usa o total copiado no Item quando há', () => {
        expect(totalDoItem({ tipo: 'anime', progresso_total: 24, numero_episodios: 28 })).toBe(24);
    });

    it('sem a cópia, usa o total da Mídia pelo Tipo', () => {
        expect(totalDoItem({ tipo: 'anime', progresso_total: null, numero_episodios: 28, numero_capitulos: null })).toBe(28);
        expect(totalDoItem({ tipo: 'manga', progresso_total: null, numero_episodios: null, numero_capitulos: 95 })).toBe(95);
    });

    it('sem total conhecido, ou no jogo, é null', () => {
        expect(totalDoItem({ tipo: 'manga', progresso_total: null, numero_capitulos: null })).toBeNull();
        expect(totalDoItem({ tipo: 'jogo', progresso_total: 40 })).toBeNull();
    });
});
