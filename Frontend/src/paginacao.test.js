import { buscarTodasAsPaginas } from './paginacao';

const pagina = (itens, numero, total) => ({ itens, pagina: numero, por_pagina: 50, total });

describe('buscarTodasAsPaginas', () => {
    test('pede as páginas até juntar o total', async () => {
        const primeira = Array.from({ length: 50 }, (_, i) => ({ id: i }));
        const apiCall = jest.fn()
            .mockResolvedValueOnce(pagina(primeira, 1, 52))
            .mockResolvedValueOnce(pagina([{ id: 50 }, { id: 51 }], 2, 52));

        const { itens, total } = await buscarTodasAsPaginas(apiCall, '/avaliacoes/MID-1');

        expect(apiCall).toHaveBeenNthCalledWith(1, '/avaliacoes/MID-1?pagina=1&por_pagina=50');
        expect(apiCall).toHaveBeenNthCalledWith(2, '/avaliacoes/MID-1?pagina=2&por_pagina=50');
        expect(itens).toHaveLength(52);
        expect(total).toBe(52);
    });

    test('para numa página só quando cabe tudo e mantém a query existente', async () => {
        const apiCall = jest.fn().mockResolvedValueOnce(pagina([{ id: 1 }], 1, 1));

        await buscarTodasAsPaginas(apiCall, '/moderacao/usuarios?x=1');

        expect(apiCall).toHaveBeenCalledTimes(1);
        expect(apiCall).toHaveBeenCalledWith('/moderacao/usuarios?x=1&pagina=1&por_pagina=50');
    });

    test('para se uma página vier vazia antes do total', async () => {
        const apiCall = jest.fn().mockResolvedValueOnce(pagina([], 1, 10));

        const { itens, total } = await buscarTodasAsPaginas(apiCall, '/x');

        expect(apiCall).toHaveBeenCalledTimes(1);
        expect(itens).toEqual([]);
        expect(total).toBe(10);
    });
});
