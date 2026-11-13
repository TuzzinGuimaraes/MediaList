import { lerNota, notasDaMidia } from './notas';

describe('notasDaMidia', () => {
    test('com Avaliações e Nota da fonte, as duas com rótulos distintos', () => {
        expect(notasDaMidia({ nota_media: 9.25, nota_fonte: 8.4, origem_nota: 'AniList' })).toEqual([
            { rotulo: 'Nota dos Usuários', valor: '9.3', daFonte: false },
            { rotulo: 'Nota AniList', valor: '8.4', daFonte: true },
        ]);
    });

    test('jogo sem Avaliações: só a Nota RAWG', () => {
        expect(notasDaMidia({ nota_media: null, nota_fonte: '9.0', origem_nota: 'RAWG' })).toEqual([
            { rotulo: 'Nota RAWG', valor: '9.0', daFonte: true },
        ]);
    });

    test('sem nenhuma nota, nada; Nota média 0 é nota', () => {
        expect(notasDaMidia({ nota_media: null, nota_fonte: null })).toEqual([]);
        expect(notasDaMidia({})).toEqual([]);
        expect(notasDaMidia({ nota_media: 0 })).toEqual([{ rotulo: 'Nota dos Usuários', valor: '0.0', daFonte: false }]);
    });

    test('Nota da fonte sem origem conhecida usa o rótulo genérico', () => {
        expect(notasDaMidia({ nota_fonte: 6 })[0].rotulo).toBe('Nota da fonte');
    });
});

describe('lerNota', () => {
    test.each([['0', 0], ['10', 10], ['7.5', 7.5], ['7,5', 7.5], [' 9 ', 9]])('aceita %s', (texto, nota) => {
        expect(lerNota(texto)).toBe(nota);
    });

    test.each(['8.55', '10.1', '-1', '11', 'oito', '1e1', ''])('recusa %s', (texto) => {
        expect(lerNota(texto)).toBeNull();
    });
});
