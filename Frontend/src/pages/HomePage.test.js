import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { MemoryRouter } from '../testRouterMock';

import HomePage from './HomePage';

jest.mock('react-router-dom', () => require('../testRouterMock'), { virtual: true });

jest.mock('../contexts/ApiContext', () => ({
    useApi: jest.fn(),
}));

jest.mock('../contexts/SessionContext', () => ({
    useSession: jest.fn(),
}));

jest.mock('../components/cards/MediaCard', () => ({ midia, onClick }) => (
    <button onClick={onClick}>{midia.titulo_portugues || midia.titulo_original}</button>
));

jest.mock('../components/media/ListEditorModal', () => ({ isOpen, onSave }) => (
    isOpen ? <button onClick={onSave}>modal-save</button> : null
));

const { useApi } = require('../contexts/ApiContext');
const { useSession } = require('../contexts/SessionContext');


describe('HomePage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('carrega dados corretos para animanga', async () => {
        useSession.mockReturnValue({
            sessaoConfig: { tipos: ['anime', 'manga'] },
        });
        useApi.mockReturnValue({
            apiCall: jest.fn().mockImplementation((endpoint) => {
                if (endpoint === '/lista') {
                    return Promise.resolve({ lista: [{ id_lista: 'L1', tipo: 'anime', status_consumo: 'assistindo', titulo_portugues: 'Anime Progress', progresso_atual: 2, progresso_total: 12 }] });
                }
                if (endpoint.startsWith('/midias?tipo=anime')) {
                    return Promise.resolve({ midias: [{ id_midia: 'MID-A', titulo_portugues: 'Anime Top', nota_media: 9, data_lancamento: '2026-04-01' }] });
                }
                return Promise.resolve({ midias: [{ id_midia: 'MID-M', titulo_portugues: 'Manga Top', nota_media: 8, data_lancamento: '2026-03-01' }] });
            }),
        });

        render(
            <MemoryRouter>
                <HomePage />
            </MemoryRouter>
        );

        expect(await screen.findByText('Anime Progress')).toBeInTheDocument();
        expect(screen.getByText('TRENDING NOW')).toBeInTheDocument();
        expect(screen.getByText('ADDED RECENTLY')).toBeInTheDocument();
        expect(screen.getAllByText('Anime Top').length).toBeGreaterThan(0);
    });

    test('lida com catalogo vazio', async () => {
        useSession.mockReturnValue({
            sessaoConfig: { tipos: ['jogo'] },
        });
        useApi.mockReturnValue({
            apiCall: jest.fn().mockResolvedValue({ lista: [], midias: [] }),
        });

        render(
            <MemoryRouter>
                <HomePage />
            </MemoryRouter>
        );

        await waitFor(() => expect(screen.queryByText('TRENDING NOW')).not.toBeInTheDocument());
        expect(screen.queryByText('ADDED RECENTLY')).not.toBeInTheDocument();
    });

    test('abre modal de progresso e recarrega ao salvar', async () => {
        const apiCall = jest.fn().mockImplementation((endpoint) => {
            if (endpoint === '/lista') {
                return Promise.resolve({ lista: [{ id_lista: 'L1', tipo: 'anime', status_consumo: 'assistindo', titulo_portugues: 'Anime Progress', progresso_atual: 2, progresso_total: 12 }] });
            }
            return Promise.resolve({ midias: [] });
        });
        useSession.mockReturnValue({
            sessaoConfig: { tipos: ['anime'] },
        });
        useApi.mockReturnValue({ apiCall });

        render(
            <MemoryRouter>
                <HomePage />
            </MemoryRouter>
        );

        fireEvent.click(await screen.findByText('Anime Progress'));
        fireEvent.click(screen.getByText('modal-save'));

        await waitFor(() => expect(apiCall).toHaveBeenCalledTimes(4));
    });
});
