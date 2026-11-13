import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { MemoryRouter } from '../../testRouterMock';

import Header from './Header';

jest.mock('react-router-dom', () => require('../../testRouterMock'), { virtual: true });

jest.mock('../../contexts/AuthContext', () => ({
    useAuth: jest.fn(),
}));

jest.mock('../../contexts/ApiContext', () => ({
    useApi: jest.fn(),
}));

jest.mock('../../contexts/SessionContext', () => ({
    useSession: jest.fn(),
    SESSIONS: {
        animanga: { id: 'animanga', label: 'Animes/Mangás' },
        jogos: { id: 'jogos', label: 'Jogos' },
    },
}));

const { useAuth } = require('../../contexts/AuthContext');
const { useApi } = require('../../contexts/ApiContext');
const { useSession } = require('../../contexts/SessionContext');


function renderHeader(route = '/') {
    return render(
        <MemoryRouter initialEntries={[route]}>
            <Header />
        </MemoryRouter>
    );
}


describe('Header', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useAuth.mockReturnValue({
            user: { nome: 'Arthur' },
            permissions: { nivel_acesso: 'usuario', pode_moderar: 0 },
            logout: jest.fn().mockResolvedValue(undefined),
        });
        useApi.mockReturnValue({
            apiCall: jest.fn().mockResolvedValue({ notificacoes: [{ titulo: 'Nova notificação', mensagem: 'Teste' }] }),
        });
    });

    test('exibe links corretos em animanga e destaca rota ativa', () => {
        useSession.mockReturnValue({
            sessao: 'animanga',
            setSessao: jest.fn(),
        });

        renderHeader('/anime-list');

        expect(screen.getByText('Anime List')).toBeInTheDocument();
        expect(screen.getByText('Manga List')).toBeInTheDocument();
        expect(screen.queryByText('Game List')).not.toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Anime List' }).className).toMatch(/text-accent-blue/);
    });

    test('exibe links corretos em jogos e troca sessao ao clicar', () => {
        const setSessao = jest.fn();
        useSession.mockReturnValue({
            sessao: 'jogos',
            setSessao,
        });

        renderHeader('/game-list');

        expect(screen.getByText('Game List')).toBeInTheDocument();
        expect(screen.queryByText('Anime List')).not.toBeInTheDocument();

        fireEvent.click(screen.getByText('Animes/Mangás'));
        expect(setSessao).toHaveBeenCalledWith('animanga');
    });

    test('carrega notificacoes e mostra admin para usuario autorizado', async () => {
        const apiCall = jest.fn().mockResolvedValue({ notificacoes: [{ titulo: 'Nova notificação', mensagem: 'Teste' }] });
        useAuth.mockReturnValue({
            user: { nome: 'Arthur' },
            permissions: { nivel_acesso: 'admin', pode_moderar: 1 },
            logout: jest.fn().mockResolvedValue(undefined),
        });
        useApi.mockReturnValue({ apiCall });
        useSession.mockReturnValue({
            sessao: 'animanga',
            setSessao: jest.fn(),
        });

        renderHeader('/');

        fireEvent.click(screen.getByRole('button', { name: 'Notificações' }));

        expect(await screen.findByText('Nova notificação')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin');
        await waitFor(() => expect(apiCall).toHaveBeenCalled());
    });
});
