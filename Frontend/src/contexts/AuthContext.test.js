import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { AuthProvider, useAuth } from './AuthContext';

jest.mock('./ApiContext', () => ({
    useApi: jest.fn(),
}));

const { useApi } = require('./ApiContext');


function AuthConsumer() {
    const { user, permissions, loading, login, logout } = useAuth();

    return (
        <div>
            <span data-testid="loading">{String(loading)}</span>
            <span data-testid="user">{user ? user.email : 'anon'}</span>
            <span data-testid="permissions">{permissions ? permissions.nivel_acesso : 'none'}</span>
            <button onClick={() => login('user@example.com', 'senha123')}>login</button>
            <button onClick={() => logout()}>logout</button>
        </div>
    );
}


describe('AuthContext', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
        global.fetch = jest.fn().mockResolvedValue({ ok: true });
    });

    test('carrega usuario de localStorage e valida token', async () => {
        localStorage.setItem('token', 'token-1');
        localStorage.setItem('user', JSON.stringify({ email: 'user@example.com' }));
        localStorage.setItem('permissions', JSON.stringify({ nivel_acesso: 'usuario' }));
        useApi.mockReturnValue({
            apiCall: jest.fn().mockResolvedValue({ usuario: { id_usuario: 'USR-1' } }),
        });

        render(
            <AuthProvider>
                <AuthConsumer />
            </AuthProvider>
        );

        await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
        expect(screen.getByTestId('user')).toHaveTextContent('user@example.com');
        expect(screen.getByTestId('permissions')).toHaveTextContent('usuario');
    });

    test('faz login e persiste token usuario e permissoes', async () => {
        useApi.mockReturnValue({
            apiCall: jest.fn().mockResolvedValue({
                access_token: 'token-login',
                usuario: {
                    id: 'USR-1',
                    email: 'user@example.com',
                    // As mesmas `Permissoes` de GET /usuario/permissoes.
                    permissoes: {
                        nivel_acesso: 'admin',
                        grupos: 'Administradores',
                        pode_criar: true,
                        pode_editar: false,
                        pode_deletar: false,
                        pode_moderar: true,
                    },
                },
            }),
        });

        render(
            <AuthProvider>
                <AuthConsumer />
            </AuthProvider>
        );

        fireEvent.click(screen.getByText('login'));

        await waitFor(() => expect(localStorage.getItem('token')).toBe('token-login'));
        expect(JSON.parse(localStorage.getItem('user')).email).toBe('user@example.com');
        expect(JSON.parse(localStorage.getItem('permissions'))).toEqual({
            nivel_acesso: 'admin',
            grupos: 'Administradores',
            pode_criar: true,
            pode_editar: false,
            pode_deletar: false,
            pode_moderar: true,
        });
        expect(screen.getByTestId('user')).toHaveTextContent('user@example.com');
    });

    test('faz logout e limpa estado', async () => {
        localStorage.setItem('token', 'token-1');
        localStorage.setItem('user', JSON.stringify({ email: 'user@example.com' }));
        localStorage.setItem('permissions', JSON.stringify({ nivel_acesso: 'usuario' }));
        useApi.mockReturnValue({
            apiCall: jest.fn().mockResolvedValue({ usuario: { id_usuario: 'USR-1' } }),
        });

        render(
            <AuthProvider>
                <AuthConsumer />
            </AuthProvider>
        );

        await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
        fireEvent.click(screen.getByText('logout'));

        await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('anon'));
        expect(localStorage.getItem('token')).toBeNull();
        expect(localStorage.getItem('user')).toBeNull();
        expect(localStorage.getItem('permissions')).toBeNull();
    });
});
