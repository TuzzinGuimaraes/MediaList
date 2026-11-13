import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import App from './App';

jest.mock('react-router-dom', () => require('./testRouterMock'), { virtual: true });

jest.mock('./contexts/ApiContext', () => ({
    ApiProvider: ({ children, onUnauthorized }) => (
        <div>
            <button onClick={onUnauthorized}>force-unauthorized</button>
            {children}
        </div>
    ),
}));

jest.mock('./contexts/AuthContext', () => ({
    AuthProvider: ({ children }) => children,
    useAuth: jest.fn(),
}));

jest.mock('./contexts/SessionContext', () => ({
    SessionProvider: ({ children }) => children,
}));

jest.mock('./pages/LoginPage', () => () => <div>login-page</div>);
jest.mock('./pages/HomePage', () => () => <div>home-page</div>);
jest.mock('./pages/BrowsePage', () => () => <div>browse-page</div>);
jest.mock('./pages/MediaDetailPage', () => () => <div>detail-page</div>);
jest.mock('./pages/MediaListPage', () => ({
    AnimeListPage: () => <div>anime-list-page</div>,
    MangaListPage: () => <div>manga-list-page</div>,
    GameListPage: () => <div>game-list-page</div>,
}));
jest.mock('./pages/StatsPage', () => () => <div>stats-page</div>);
jest.mock('./pages/NewsPage', () => () => <div>news-page</div>);
jest.mock('./pages/AdminPage', () => () => <div>admin-page</div>);
jest.mock('./pages/ProfilePage', () => () => <div>profile-page</div>);

const { useAuth } = require('./contexts/AuthContext');


describe('App', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
    });

    test('renderiza AuthLayout em /login', () => {
        useAuth.mockReturnValue({ user: null, loading: false });
        window.history.pushState({}, 'Test', '/login');

        render(<App />);

        expect(screen.getByText('login-page')).toBeInTheDocument();
    });

    test('protege rotas autenticadas redirecionando para login', () => {
        useAuth.mockReturnValue({ user: null, loading: false });
        window.history.pushState({}, 'Test', '/');

        render(<App />);

        expect(screen.getByText('login-page')).toBeInTheDocument();
    });

    test('renderiza 404 para rota desconhecida', () => {
        useAuth.mockReturnValue({ user: { nome: 'Teste' }, loading: false });
        window.history.pushState({}, 'Test', '/rota-desconhecida');

        render(<App />);

        expect(screen.getByText('404')).toBeInTheDocument();
        expect(screen.getByText('Página não encontrada')).toBeInTheDocument();
    });

    test('limpa localStorage ao receber onUnauthorized', () => {
        useAuth.mockReturnValue({ user: null, loading: false });
        localStorage.setItem('token', 'token');
        localStorage.setItem('user', '{"nome":"Teste"}');
        localStorage.setItem('permissions', '{"nivel_acesso":"admin"}');
        window.history.pushState({}, 'Test', '/');

        render(<App />);
        fireEvent.click(screen.getByText('force-unauthorized'));

        expect(localStorage.getItem('token')).toBeNull();
        expect(localStorage.getItem('user')).toBeNull();
        expect(localStorage.getItem('permissions')).toBeNull();
    });
});
