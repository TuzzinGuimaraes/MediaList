import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import StatsPage from './StatsPage';

jest.mock('../contexts/ApiContext', () => ({
    useApi: jest.fn(),
}));

jest.mock('../contexts/SessionContext', () => ({
    useSession: jest.fn(),
}));

jest.mock('recharts', () => ({
    ResponsiveContainer: ({ children }) => <div>{children}</div>,
    BarChart: ({ children, data = [] }) => (
        <div>
            {data.filter(d => d.name).map(d => <span key={d.name}>{`barra:${d.name}`}</span>)}
            {children}
        </div>
    ),
    Bar: () => <div>bar</div>,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    PieChart: ({ children }) => <div>{children}</div>,
    Pie: ({ children }) => <div>{children}</div>,
    Cell: () => null,
    Legend: () => null,
}));

const { useApi } = require('../contexts/ApiContext');
const { useSession } = require('../contexts/SessionContext');


describe('StatsPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('monta sidebar correta para animanga e alterna entre overview e genres', async () => {
        useSession.mockReturnValue({ sessao: 'animanga' });
        useApi.mockReturnValue({
            apiCall: jest.fn().mockImplementation((endpoint) => {
                if (endpoint === '/usuario/estatisticas') {
                    return Promise.resolve({
                        resumo: { total_midias: 3, concluidos: 1, em_andamento: 2, favoritos: 1 },
                        estatisticas: [
                            { tipo: 'anime', total_midias: 2, concluidos: 1, em_andamento: 1, favoritos: 1, nota_media: 8.5 },
                            { tipo: 'manga', total_midias: 1, concluidos: 0, em_andamento: 1, favoritos: 0, nota_media: 7.5 },
                        ],
                    });
                }
                return Promise.resolve({
                    lista: [
                        { tipo: 'anime', status_consumo: 'assistindo', nota_usuario: 8, generos: 'Ação, Drama' },
                        { tipo: 'anime', status_consumo: 'completo', nota_usuario: 9, generos: 'Drama' },
                    ],
                });
            }),
        });

        render(<StatsPage />);

        expect((await screen.findAllByText('Anime Stats')).length).toBeGreaterThan(0);
        expect(screen.getByText('Score Distribution')).toBeInTheDocument();

        fireEvent.click(screen.getAllByText('Genres')[0]);
        expect(screen.getByText('Genre Distribution')).toBeInTheDocument();
    });

    test('genres exibe genero vindo como objeto com nome_genero', async () => {
        useSession.mockReturnValue({ sessao: 'animanga' });
        useApi.mockReturnValue({
            apiCall: jest.fn().mockImplementation((endpoint) => {
                if (endpoint === '/usuario/estatisticas') {
                    return Promise.resolve({
                        resumo: { total_midias: 1, concluidos: 0, em_andamento: 1, favoritos: 0 },
                        estatisticas: [{ tipo: 'anime', total_midias: 1, concluidos: 0, em_andamento: 1, favoritos: 0 }],
                    });
                }
                return Promise.resolve({
                    lista: [
                        { tipo: 'anime', status_consumo: 'assistindo', generos: [{ id_genero: 1, nome_genero: 'Mecha' }] },
                    ],
                });
            }),
        });

        render(<StatsPage />);

        expect((await screen.findAllByText('Anime Stats')).length).toBeGreaterThan(0);
        fireEvent.click(screen.getAllByText('Genres')[0]);
        expect(screen.getByText('barra:Mecha')).toBeInTheDocument();
    });

    test('renderiza platforms apenas para jogos e lida com lista vazia', async () => {
        useSession.mockReturnValue({ sessao: 'jogos' });
        useApi.mockReturnValue({
            apiCall: jest.fn().mockImplementation((endpoint) => {
                if (endpoint === '/usuario/estatisticas') {
                    return Promise.resolve({
                        resumo: { total_midias: 0, concluidos: 0, em_andamento: 0, favoritos: 0 },
                        estatisticas: [{ tipo: 'jogo', total_midias: 0, concluidos: 0, em_andamento: 0, favoritos: 0 }],
                    });
                }
                return Promise.resolve({ lista: [] });
            }),
        });

        render(<StatsPage />);

        expect((await screen.findAllByText('Game Stats')).length).toBeGreaterThan(0);
        fireEvent.click(screen.getAllByText('Platforms')[0]);
        expect(screen.getByText('Platform Distribution')).toBeInTheDocument();
        expect(screen.getByText('Sem plataformas suficientes para exibir distribuição.')).toBeInTheDocument();
    });
});
