import React from 'react';
import { render, screen } from '@testing-library/react';

import { MemoryRouter, Route, Routes } from '../testRouterMock';
import AuthLayout from './AuthLayout';

jest.mock('react-router-dom', () => require('../testRouterMock'), { virtual: true });

jest.mock('../contexts/AuthContext', () => ({
    useAuth: jest.fn(),
}));

const { useAuth } = require('../contexts/AuthContext');


function renderLayout(route = '/login') {
    return render(
        <MemoryRouter initialEntries={[route]}>
            <Routes>
                <Route element={<AuthLayout />}>
                    <Route path="/login" element={<div>conteudo-auth</div>} />
                </Route>
                <Route path="/" element={<div>home-destino</div>} />
            </Routes>
        </MemoryRouter>
    );
}


describe('AuthLayout', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renderiza loading enquanto autenticacao carrega', () => {
        useAuth.mockReturnValue({ user: null, loading: true });

        renderLayout();

        expect(screen.getByRole('status', { name: 'Carregando' })).toBeInTheDocument();
    });

    test('redireciona para home quando usuario ja esta autenticado', () => {
        useAuth.mockReturnValue({ user: { nome: 'Teste' }, loading: false });

        renderLayout();

        expect(screen.getByText('home-destino')).toBeInTheDocument();
    });

    test('renderiza outlet quando usuario nao esta autenticado', () => {
        useAuth.mockReturnValue({ user: null, loading: false });

        renderLayout();

        expect(screen.getByText('conteudo-auth')).toBeInTheDocument();
    });
});
