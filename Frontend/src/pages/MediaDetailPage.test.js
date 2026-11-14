import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { MemoryRouter, Route, Routes } from '../testRouterMock';

import MediaDetailPage from './MediaDetailPage';

jest.mock('react-router-dom', () => require('../testRouterMock'), { virtual: true });

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

    test('busca dados em paralelo, usa generos_lista e STATUS_COLORS', async () => {
        const apiCall = jest.fn().mockImplementation((endpoint) => {
            if (endpoint === '/midias/MID-1') {
                return Promise.resolve({
                    id_midia: 'MID-1',
                    tipo: 'anime',
                    titulo_portugues: 'Anime X',
                    titulo_original: 'Anime X',
                    generos: 'Ação, Drama',
                    generos_lista: ['Ação', 'Drama'],
                    numero_episodios: 24,
                    status_anime: 'em_exibicao',
                    total_usuarios: 4,
                });
            }
            if (endpoint.startsWith('/avaliacoes/MID-1?')) {
                return Promise.resolve({ itens: [{ id_avaliacao: 'AVL-1', nome_completo: 'User', data_avaliacao: '2026-04-01T12:00:00Z', nota: 9 }], pagina: 1, por_pagina: 10, total: 1 });
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

    test('conta as Avaliações pelo total, pede só a 1ª página e desenha as notas de /notas', async () => {
        const avaliacao = (i) => ({ id_avaliacao: `AVL-${i}`, nome_completo: `User ${i}`, data_avaliacao: '2026-04-01T12:00:00Z', nota: 8 });
        const distribuicao = Array.from({ length: 10 }, (_, i) => ({ nota: i + 1, total: i === 7 ? 52 : 0 }));
        const apiCall = jest.fn().mockImplementation((endpoint) => {
            if (endpoint === '/midias/MID-1') return Promise.resolve({ id_midia: 'MID-1', tipo: 'anime', titulo_portugues: 'Anime X', generos_lista: [] });
            if (endpoint === '/avaliacoes/MID-1?por_pagina=10') {
                return Promise.resolve({ itens: Array.from({ length: 10 }, (_, i) => avaliacao(i)), pagina: 1, por_pagina: 10, total: 52 });
            }
            if (endpoint === '/midias/MID-1/notas') return Promise.resolve({ distribuicao, minha_avaliacao: null });
            if (endpoint === '/lista') return Promise.resolve({ lista: [] });
            if (endpoint === '/midias/MID-1/distribuicao') return Promise.resolve({ distribuicao: [] });
            return Promise.resolve({});
        });
        useApi.mockReturnValue({ apiCall });

        renderPage();

        expect(await screen.findByText('Avaliações (52)')).toBeInTheDocument();
        expect(screen.getAllByText(/^User \d$/)).toHaveLength(10);
        expect(screen.getByText('Score Distribution')).toBeInTheDocument();
        const avaliacoesPedidas = apiCall.mock.calls.map(([e]) => e).filter((e) => e.startsWith('/avaliacoes/'));
        expect(avaliacoesPedidas).toEqual(['/avaliacoes/MID-1?por_pagina=10']);
    });

    test('sem nenhuma nota nas faixas, não desenha o gráfico', async () => {
        useApi.mockReturnValue({ apiCall: apiComMidia({}) });

        renderPage();

        expect(await screen.findByText('Sem avaliações')).toBeInTheDocument();
        expect(screen.queryByText('Score Distribution')).not.toBeInTheDocument();
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
            if (endpoint.startsWith('/avaliacoes/MID-1?')) return Promise.resolve({ itens: [], pagina: 1, por_pagina: 50, total: 0 });
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

    function apiComMidia(midia) {
        const semNotas = { distribuicao: Array.from({ length: 10 }, (_, i) => ({ nota: i + 1, total: 0 })), minha_avaliacao: null };
        return jest.fn().mockImplementation((endpoint) => {
            if (endpoint === '/midias/MID-1') return Promise.resolve({ id_midia: 'MID-1', tipo: 'anime', titulo_portugues: 'Anime X', ...midia });
            if (endpoint.startsWith('/avaliacoes/MID-1?')) return Promise.resolve({ itens: [], pagina: 1, por_pagina: 10, total: 0 });
            if (endpoint === '/midias/MID-1/notas') return Promise.resolve(semNotas);
            if (endpoint === '/lista') return Promise.resolve({ lista: [] });
            if (endpoint === '/midias/MID-1/distribuicao') return Promise.resolve({ distribuicao: [] });
            return Promise.resolve({});
        });
    }

    test('mostra a Nota dos Usuários e a Nota AniList com rótulos distintos', async () => {
        useApi.mockReturnValue({ apiCall: apiComMidia({ nota_media: 9.25, nota_fonte: 8.4, origem_nota: 'AniList' }) });

        renderPage();

        expect(await screen.findByLabelText('Nota dos Usuários: 9.3')).toBeInTheDocument();
        expect(screen.getByText('Nota dos Usuários')).toBeInTheDocument();
        expect(screen.getByLabelText('Nota AniList: 8.4')).toBeInTheDocument();
        expect(screen.getByText('Nota AniList')).toBeInTheDocument();
    });

    test('sem Avaliações mostra só a Nota da fonte; sem nenhuma, nada', async () => {
        useApi.mockReturnValue({ apiCall: apiComMidia({ tipo: 'jogo', nota_media: null, nota_fonte: 9, origem_nota: 'RAWG' }) });
        const { unmount } = renderPage();

        expect(await screen.findByLabelText('Nota RAWG: 9.0')).toBeInTheDocument();
        expect(screen.queryByText('Nota dos Usuários')).not.toBeInTheDocument();
        unmount();

        useApi.mockReturnValue({ apiCall: apiComMidia({ nota_media: null, nota_fonte: null }) });
        renderPage();

        expect(await screen.findByText('Anime X')).toBeInTheDocument();
        expect(screen.queryByLabelText(/^Nota /)).not.toBeInTheDocument();
    });
});
