import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { MemoryRouter, Route, Routes } from '../testRouterMock';

import BrowsePage from './BrowsePage';

jest.mock('react-router-dom', () => require('../testRouterMock'), { virtual: true });

jest.mock('../contexts/ApiContext', () => ({
    useApi: jest.fn(),
}));

jest.mock('../contexts/SessionContext', () => ({
    useSession: jest.fn(),
}));

jest.mock('../components/cards/MediaCard', () => ({ midia }) => <div>{midia.titulo_portugues || midia.titulo_original}</div>);

const { useApi } = require('../contexts/ApiContext');
const { useSession } = require('../contexts/SessionContext');


async function flushBrowseEffects() {
    await act(async () => {
        jest.runAllTimers();
        await Promise.resolve();
    });
}


function renderPage(route = '/browse') {
    return render(
        <MemoryRouter initialEntries={[route]}>
            <Routes>
                <Route path="/browse" element={<BrowsePage />} />
            </Routes>
        </MemoryRouter>
    );
}


describe('BrowsePage', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        useSession.mockReturnValue({
            sessaoConfig: {
                tipos: ['anime', 'manga'],
            },
        });
        useApi.mockReturnValue({
            apiCall: jest.fn().mockImplementation((endpoint) => {
                if (endpoint.startsWith('/generos')) {
                    return Promise.resolve({ generos: [{ id_genero: '1', nome_genero: 'Ação' }] });
                }
                return Promise.resolve({ itens: [{ id_midia: 'MID-1', titulo_portugues: 'Anime X' }], pagina: 1, por_pagina: 48, total: 1 });
            }),
        });
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    test('cai no primeiro tipo valido da sessao quando tipo for invalido', async () => {
        renderPage('/browse?tipo=invalido');
        await flushBrowseEffects();

        await screen.findByText('Anime X');
        expect(useApi().apiCall).toHaveBeenCalledWith('/midias?tipo=anime&pagina=1&por_pagina=48&ordem=nota_media');
    });

    test('aplica filtros de anime e atualiza query', async () => {
        renderPage('/browse?tipo=anime');
        await flushBrowseEffects();
        await screen.findByText('Anime X');

        fireEvent.change(screen.getByPlaceholderText('Estúdio'), { target: { value: 'Bones' } });
        fireEvent.change(screen.getByDisplayValue('Status'), { target: { value: 'em_exibicao' } });
        await flushBrowseEffects();

        await waitFor(() => expect(useApi().apiCall).toHaveBeenCalledWith(expect.stringContaining('estudio=Bones')));
        await waitFor(() =>
            expect(useApi().apiCall).toHaveBeenCalledWith(expect.stringContaining('status=em_exibicao'))
        );
    });

    test('filtro de genero lista nome_genero da API e filtra por ele', async () => {
        renderPage('/browse?tipo=anime');
        await flushBrowseEffects();
        await screen.findByText('Anime X');

        fireEvent.change(screen.getByDisplayValue('Gêneros'), { target: { value: 'Ação' } });
        await flushBrowseEffects();

        expect(screen.getByRole('option', { name: 'Ação' })).toBeInTheDocument();
        await waitFor(() => {
            expect(useApi().apiCall).toHaveBeenCalledWith(expect.stringContaining('genero=A%C3%A7%C3%A3o'));
        });
    });

    test('falha ao carregar midias mostra erro em vez de lista vazia', async () => {
        useApi.mockReturnValue({
            apiCall: jest.fn().mockImplementation((endpoint) => {
                if (endpoint.startsWith('/generos')) return Promise.resolve({ generos: [] });
                return Promise.reject(new Error('Erro de conexão com o servidor.'));
            }),
        });

        renderPage('/browse?tipo=anime');
        await flushBrowseEffects();

        expect(await screen.findByRole('alert')).toHaveTextContent('Erro de conexão com o servidor.');
        expect(screen.queryByText('Nenhuma mídia disponível')).not.toBeInTheDocument();
        expect(screen.queryByText('0 resultado(s)')).not.toBeInTheDocument();
    });

    test('troca tabs conforme sessao ativa e limpa filtros especificos ao trocar de tipo', async () => {
        renderPage('/browse?tipo=anime&estudio=Wit&status=finalizado');
        await flushBrowseEffects();
        await screen.findByText('Anime X');

        fireEvent.click(screen.getByText('Mangá'));
        await flushBrowseEffects();

        await waitFor(() => {
            expect(useApi().apiCall).toHaveBeenCalledWith('/midias?tipo=manga&pagina=1&por_pagina=48&ordem=nota_media');
        });
    });

    describe('paginacao', () => {
        const pagina = (n, quantidade) => Array.from({ length: quantidade }, (_, i) => ({
            id_midia: `P${n}-${i}`,
            titulo_portugues: `Pagina ${n} item ${i}`,
        }));

        // Envelope Pagina[Midia]; o `total` padrão soma as páginas que não são erro.
        function mockPaginas(paginas, total) {
            const totalDoFiltro = total ?? Object.values(paginas)
                .filter(Array.isArray)
                .reduce((soma, itens) => soma + itens.length, 0);
            const apiCall = jest.fn().mockImplementation((endpoint) => {
                if (endpoint.startsWith('/generos')) return Promise.resolve({ generos: [] });
                const query = new URLSearchParams(endpoint.split('?')[1]);
                const numero = Number(query.get('pagina'));
                const resposta = paginas[numero];
                return resposta instanceof Error ? Promise.reject(resposta) : Promise.resolve({
                    itens: resposta || [],
                    pagina: numero,
                    por_pagina: Number(query.get('por_pagina')),
                    total: totalDoFiltro,
                });
            });
            useApi.mockReturnValue({ apiCall });
            return apiCall;
        }

        test('carregar mais pede a segunda pagina e acrescenta os itens', async () => {
            const apiCall = mockPaginas({ 1: pagina(1, 48), 2: pagina(2, 10) });
            renderPage('/browse?tipo=anime');
            await flushBrowseEffects();
            await screen.findByText('Pagina 1 item 0');

            fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));
            await flushBrowseEffects();

            expect(await screen.findByText('Pagina 2 item 9')).toBeInTheDocument();
            expect(screen.getByText('Pagina 1 item 0')).toBeInTheDocument();
            expect(apiCall).toHaveBeenCalledWith('/midias?tipo=anime&pagina=2&por_pagina=48&ordem=nota_media');
        });

        test('mostra o total do filtro, nao so os itens carregados', async () => {
            mockPaginas({ 1: pagina(1, 48), 2: pagina(2, 47) });
            renderPage('/browse?tipo=anime');
            await flushBrowseEffects();
            await screen.findByText('Pagina 1 item 0');

            expect(screen.getByText('95 resultado(s)')).toBeInTheDocument();
        });

        test('botao some quando os itens carregados chegam ao total', async () => {
            mockPaginas({ 1: pagina(1, 48), 2: pagina(2, 47) });
            renderPage('/browse?tipo=anime');
            await flushBrowseEffects();
            await screen.findByText('Pagina 1 item 0');

            fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));
            await flushBrowseEffects();
            await screen.findByText('Pagina 2 item 46');

            expect(screen.queryByRole('button', { name: 'Carregar mais' })).not.toBeInTheDocument();
        });

        test('sem botao quando a primeira pagina ja e a ultima', async () => {
            mockPaginas({ 1: pagina(1, 3) });
            renderPage('/browse?tipo=anime');
            await flushBrowseEffects();
            await screen.findByText('Pagina 1 item 2');

            expect(screen.queryByRole('button', { name: 'Carregar mais' })).not.toBeInTheDocument();
        });

        test('trocar filtro reinicia na pagina 1', async () => {
            const apiCall = mockPaginas({ 1: pagina(1, 48), 2: pagina(2, 48) });
            renderPage('/browse?tipo=anime');
            await flushBrowseEffects();
            await screen.findByText('Pagina 1 item 0');
            fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));
            await flushBrowseEffects();
            await screen.findByText('Pagina 2 item 0');

            fireEvent.change(screen.getByPlaceholderText('Estúdio'), { target: { value: 'Bones' } });
            await flushBrowseEffects();

            await waitFor(() => expect(apiCall).toHaveBeenCalledWith(
                '/midias?tipo=anime&pagina=1&por_pagina=48&ordem=nota_media&estudio=Bones'
            ));
            await waitFor(() => expect(screen.queryByText('Pagina 2 item 0')).not.toBeInTheDocument());
            expect(screen.getByText('Pagina 1 item 0')).toBeInTheDocument();

            fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));
            await flushBrowseEffects();
            expect(apiCall).toHaveBeenLastCalledWith('/midias?tipo=anime&pagina=2&por_pagina=48&ordem=nota_media&estudio=Bones');
        });

        test('erro na proxima pagina mantem os itens e permite tentar de novo', async () => {
            const paginas = { 1: pagina(1, 48), 2: new Error('Falhou a página 2.') };
            mockPaginas(paginas, 53);
            renderPage('/browse?tipo=anime');
            await flushBrowseEffects();
            await screen.findByText('Pagina 1 item 0');

            fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));
            await flushBrowseEffects();

            expect(await screen.findByRole('alert')).toHaveTextContent('Falhou a página 2.');
            expect(screen.getByText('Pagina 1 item 0')).toBeInTheDocument();

            paginas[2] = pagina(2, 5);
            fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }));
            await flushBrowseEffects();

            expect(await screen.findByText('Pagina 2 item 4')).toBeInTheDocument();
            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });
    });
});
