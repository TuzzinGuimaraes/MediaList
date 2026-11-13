import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { MemoryRouter } from '../testRouterMock';

import LoginPage from './LoginPage';

jest.mock('react-router-dom', () => ({
    ...require('../testRouterMock'),
    useNavigate: () => mockNavigate,
}), { virtual: true });

jest.mock('../contexts/AuthContext', () => ({
    useAuth: jest.fn(),
}));

const mockNavigate = jest.fn();

const { useAuth } = require('../contexts/AuthContext');


describe('LoginPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useAuth.mockReturnValue({
            login: jest.fn(),
            register: jest.fn(),
        });
    });

    test('renderiza formulario e faz login com sucesso', async () => {
        const login = jest.fn().mockResolvedValue({ success: true });
        useAuth.mockReturnValue({ login, register: jest.fn() });

        render(
            <MemoryRouter>
                <LoginPage />
            </MemoryRouter>
        );

        fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'user@example.com' } });
        fireEvent.change(screen.getByPlaceholderText('Senha'), { target: { value: 'senha123' } });
        fireEvent.click(screen.getByText('Entrar'));

        await waitFor(() => expect(login).toHaveBeenCalledWith('user@example.com', 'senha123'));
        expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    test('exibe erro de autenticacao', async () => {
        const login = jest.fn().mockResolvedValue({ success: false, error: 'Credenciais invalidas' });
        useAuth.mockReturnValue({ login, register: jest.fn() });

        render(
            <MemoryRouter>
                <LoginPage />
            </MemoryRouter>
        );

        fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'user@example.com' } });
        fireEvent.change(screen.getByPlaceholderText('Senha'), { target: { value: 'senha123' } });
        fireEvent.click(screen.getByText('Entrar'));

        expect(await screen.findByText('Credenciais invalidas')).toBeInTheDocument();
    });

    test('alterna para registro e envia cadastro', async () => {
        const register = jest.fn().mockResolvedValue({ success: true });
        useAuth.mockReturnValue({ login: jest.fn(), register });

        render(
            <MemoryRouter>
                <LoginPage />
            </MemoryRouter>
        );

        fireEvent.click(screen.getByText('Criar nova conta'));
        fireEvent.change(screen.getByPlaceholderText('Nome Completo'), { target: { value: 'Arthur' } });
        fireEvent.change(screen.getAllByPlaceholderText('Email')[0], { target: { value: 'user@example.com' } });
        fireEvent.change(screen.getAllByPlaceholderText('Senha')[0], { target: { value: 'senha123' } });
        fireEvent.click(screen.getByText('Registrar'));

        await waitFor(() => expect(register).toHaveBeenCalledWith(expect.objectContaining({
            nome_completo: 'Arthur',
            email: 'user@example.com',
            senha: 'senha123',
        })));
    });
});
