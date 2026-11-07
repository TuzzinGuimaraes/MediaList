import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { MemoryRouter } from '../testRouterMock';

import ProfilePage from './ProfilePage';

jest.mock('react-router-dom', () => require('../testRouterMock'), { virtual: true });

jest.mock('../contexts/AuthContext', () => ({
    useAuth: jest.fn(),
}));

jest.mock('../contexts/ApiContext', () => ({
    useApi: jest.fn(),
}));

jest.mock('./MediaListPage', () => ({ tipo }) => <div>{tipo}-list-fragment</div>);
jest.mock('./StatsPage', () => () => <div>stats-fragment</div>);

const { useAuth } = require('../contexts/AuthContext');
const { useApi } = require('../contexts/ApiContext');


describe('ProfilePage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useAuth.mockReturnValue({
            user: { nome: 'Arthur', data_criacao: '2026-04-01' },
        });
        useApi.mockReturnValue({
            apiCall: jest.fn().mockImplementation((endpoint) => {
                if (endpoint === '/usuario/estatisticas') {
                    return Promise.resolve({ resumo: { total_midias: 3, concluidos: 1, em_andamento: 1, favoritos: 1 } });
                }
                return Promise.resolve({
                    lista: [
                        { id_lista: 'L1', id_midia: 'MID-1', favorito: true, poster_url: 'poster.jpg', titulo_portugues: 'Anime X', generos: 'Ação, Drama' },
                        { id_lista: 'L2', id_midia: 'MID-2', favorito: false, titulo_portugues: 'Game X', generos: 'Drama' },
                    ],
                });
            }),
        });
    });

    test('renderiza overview por padrao sem bloco antigo de per-type stats', async () => {
        render(
            <MemoryRouter>
                <ProfilePage />
            </MemoryRouter>
        );

        expect(await screen.findByText('Genre Overview')).toBeInTheDocument();
        expect(screen.getAllByText('Favoritos').length).toBeGreaterThan(0);
        expect(screen.queryByText('Per-Type Stats')).not.toBeInTheDocument();
    });

    test('alterna para listas e stats', async () => {
        render(
            <MemoryRouter>
                <ProfilePage />
            </MemoryRouter>
        );

        await screen.findByText('Genre Overview');
        fireEvent.click(screen.getByText('Anime List'));
        expect(screen.getByText('anime-list-fragment')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Stats'));
        expect(screen.getByText('stats-fragment')).toBeInTheDocument();
    });
});
