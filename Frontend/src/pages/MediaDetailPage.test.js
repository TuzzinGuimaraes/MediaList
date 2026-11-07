import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('react-router-dom', () => require('../testRouterMock'), { virtual: true });

import { MemoryRouter, Route, Routes } from '../testRouterMock';

import MediaDetailPage from './MediaDetailPage';

jest.mock('../contexts/ApiContext', () => ({
    useApi: jest.fn(),
}));

jest.mock('../components/media/ListEditorModal', () => ({ isOpen, onSave }) => (
    isOpen ? <button onClick={onSave}>modal-save</button> : null
));

jest.mock('recharts', () => ({
    ResponsiveContainer: ({ children }) => <div>{children}</div>,
    BarChart: ({ children }) => <div>{children}</div>,
    Bar: () => <div>bar</div>,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
}));

const { useApi } = require('../contexts/ApiContext');


function renderPage(route = '/media/MID-1') {
    return render(
        <MemoryRouter initialEntries={[route]}>
            <Routes>
                <Route path="/media/:id" element={<MediaDetailPage />} />
            </Routes>
        </MemoryRouter>
    );
}


describe('MediaDetailPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('busca dados em paralelo, normaliza generos e usa STATUS_COLORS', async () => {
        const apiCall = jest.fn().mockImplementation((endpoint) => {
            if (endpoint === '/midias/MID-1') {
                return Promise.resolve({
                    id_midia: 'MID-1',
                    tipo: 'anime',
                    titulo_portugues: 'Anime X',
                    titulo_original: 'Anime X',
                    generos: 'Ação, Drama',
                    numero_episodios: 24,
                    status_anime: 'em_exibicao',
                    total_usuarios: 4,
                });
            }
            if (endpoint === '/avaliacoes/MID-1') {
                return Promise.resolve({ avaliacoes: [{ id_avaliacao: 'AVL-1', nome_completo: 'User', data_avaliacao: '2026-04-01', nota: 9 }] });
            }
            if (endpoint === '/lista') {
                return Promise.resolve({ lista: [{ id_lista: 'LST-1', id_midia: 'MID-1', status_consumo: 'assistindo' }] });
            }
            if (endpoint === '/midias/MID-1/distribuicao') {
                return Promise.resolve({ distribuicao: [{ status_consumo: 'assistindo', total: 3 }] });
            }
            return Promise.resolve({});
        });
        useApi.mockReturnValue({ apiCall });

        renderPage();

        expect(await screen.findByText('Anime X')).toBeInTheDocument();
        expect(screen.getByText('Ação')).toBeInTheDocument();
        expect(screen.getByText('Drama')).toBeInTheDocument();
        expect(screen.getByText('Status Distribution')).toBeInTheDocument();
        expect(screen.getByText('Current: 3')).toBeInTheDocument();
        expect(screen.getByText('Editar na Lista')).toBeInTheDocument();
    });

    test('abre modal e recarrega apos salvar', async () => {
        const apiCall = jest.fn().mockImplementation((endpoint) => {
            if (endpoint === '/midias/MID-1') {
                return Promise.resolve({
                    id_midia: 'MID-1',
                    tipo: 'jogo',
                    titulo_portugues: 'Game X',
                    plataformas: 'PC, PS5',
                    total_usuarios: 0,
                });
            }
            if (endpoint === '/avaliacoes/MID-1') return Promise.resolve({ avaliacoes: [] });
            if (endpoint === '/lista') return Promise.resolve({ lista: [] });
            if (endpoint === '/midias/MID-1/distribuicao') return Promise.resolve({ distribuicao: [] });
            return Promise.resolve({});
        });
        useApi.mockReturnValue({ apiCall });

        renderPage();

        expect(await screen.findByText('Game X')).toBeInTheDocument();
        fireEvent.click(screen.getByText('Adicionar à Lista'));
        fireEvent.click(screen.getByText('modal-save'));

        await waitFor(() => expect(apiCall).toHaveBeenCalledWith('/midias/MID-1'));
        expect(await screen.findByText('Platforms')).toBeInTheDocument();
    });

    test('lida com midia inexistente', async () => {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        useApi.mockReturnValue({
            apiCall: jest.fn().mockRejectedValue(
                Object.assign(new Error('Mídia não encontrada'), { status: 404 })
            ),
        });

        renderPage();

        expect(await screen.findByText('Mídia não encontrada')).toBeInTheDocument();
        console.error.mockRestore();
    });

    test('falha ao carregar a midia mostra erro em vez de nao encontrada', async () => {
        useApi.mockReturnValue({
            apiCall: jest.fn().mockImplementation((endpoint) => (
                endpoint === '/midias/MID-1'
                    ? Promise.reject(new Error('Erro de conexão com o servidor.'))
                    : Promise.resolve({})
            )),
        });

        renderPage();

        expect(await screen.findByRole('alert')).toHaveTextContent('Erro de conexão com o servidor.');
        expect(screen.queryByText('Mídia não encontrada')).not.toBeInTheDocument();
    });
});
