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
                    return Promise.resolve({ generos: [{ id_genero: 1, nome_genero: 'Ação' }] });
                }
                return Promise.resolve({ midias: [{ id_midia: 'MID-1', titulo_portugues: 'Anime X' }] });
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
        expect(useApi().apiCall).toHaveBeenCalledWith('/midias?tipo=anime&por_pagina=200&ordem=nota_media');
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
            expect(useApi().apiCall).toHaveBeenCalledWith('/midias?tipo=manga&por_pagina=200&ordem=nota_media');
        });
    });
});
