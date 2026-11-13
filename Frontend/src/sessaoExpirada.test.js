import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import App from './App';

jest.mock('react-router-dom', () => require('./testRouterMock'), { virtual: true });

jest.mock('./components/layout/Header', () => () => <div>header</div>);
jest.mock('./pages/LoginPage', () => () => <div>login-page</div>);
jest.mock('./pages/HomePage', () => {
    const { useApi: usarApi } = require('./contexts/ApiContext');
    return function HomeQueChamaApi() {
        const { apiCall } = usarApi();
        return (
            <button onClick={() => apiCall('/lista').catch(() => {})}>
                home-chama-api
            </button>
        );
    };
});

function resposta(status, corpo) {
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: () => 'application/json' },
        json: async () => corpo,
    };
}

describe('sessão expirada', () => {
    beforeEach(() => {
        localStorage.clear();
        localStorage.setItem('token', 'token-velho');
        localStorage.setItem('user', JSON.stringify({ email: 'user@example.com' }));
        localStorage.setItem('permissions', JSON.stringify({ nivel_acesso: 'usuario' }));
        window.history.pushState({}, 'Test', '/');
    });

    test('401 numa chamada autenticada desloga e leva ao login', async () => {
        global.fetch = jest.fn((url) => {
            if (url.endsWith('/auth/me')) return Promise.resolve(resposta(200, { usuario: {} }));
            return Promise.resolve(resposta(401, { msg: 'Token has expired' }));
        });

        render(<App />);

        fireEvent.click(await screen.findByText('home-chama-api'));

        expect(await screen.findByText('login-page')).toBeInTheDocument();
        expect(localStorage.getItem('token')).toBeNull();
        expect(localStorage.getItem('user')).toBeNull();
    });
});
