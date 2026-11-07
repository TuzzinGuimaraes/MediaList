import React from 'react';
import { render, screen } from '@testing-library/react';

import { MemoryRouter, Route, Routes } from '../testRouterMock';
import MainLayout from './MainLayout';

jest.mock('react-router-dom', () => require('../testRouterMock'), { virtual: true });

jest.mock('../components/layout/Header', () => () => <div>header-layout</div>);
jest.mock('../contexts/AuthContext', () => ({
    useAuth: jest.fn(),
}));

const { useAuth } = require('../contexts/AuthContext');


function renderLayout(route = '/') {
    return render(
        <MemoryRouter initialEntries={[route]}>
            <Routes>
                <Route path="/" element={<MainLayout />}>
                    <Route path="/" element={<div>conteudo-protegido</div>} />
                </Route>
                <Route path="/login" element={<div>login-destino</div>} />
            </Routes>
        </MemoryRouter>
    );
}


describe('MainLayout', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('renderiza loading enquanto autenticacao carrega', () => {
        useAuth.mockReturnValue({ user: null, loading: true });

        renderLayout();

        expect(screen.getByRole('status', { name: 'Carregando' })).toBeInTheDocument();
    });

    test('redireciona para login quando usuario nao existe', () => {
        useAuth.mockReturnValue({ user: null, loading: false });

        renderLayout();

        expect(screen.getByText('login-destino')).toBeInTheDocument();
    });

    test('renderiza header e outlet quando usuario esta autenticado', () => {
        useAuth.mockReturnValue({ user: { nome: 'Teste' }, loading: false });

        renderLayout();

        expect(screen.getByText('header-layout')).toBeInTheDocument();
        expect(screen.getByText('conteudo-protegido')).toBeInTheDocument();
    });
});
