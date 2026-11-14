import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ApiProvider, useApi } from './ApiContext';


function ApiConsumer() {
    const { apiCall } = useApi();

    return (
        <button onClick={() => apiCall('/ping')}>
            chamar
        </button>
    );
}


function ApiErrorConsumer() {
    const { apiCall } = useApi();

    return (
        <button
            onClick={async () => {
                try {
                    await apiCall('/erro');
                } catch (error) {
                    document.body.dataset.errorMessage = error.message;
                }
            }}
        >
            erro
        </button>
    );
}


describe('ApiContext', () => {
    beforeEach(() => {
        localStorage.clear();
        jest.clearAllMocks();
        delete document.body.dataset.errorMessage;
    });

    test('anexa token nas requisicoes autenticadas', async () => {
        localStorage.setItem('token', 'token-123');
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({ ok: true }),
        });

        render(
            <ApiProvider>
                <ApiConsumer />
            </ApiProvider>
        );

        fireEvent.click(screen.getByText('chamar'));

        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
        expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer token-123');
    });

    test('aciona onUnauthorized em 401', async () => {
        localStorage.setItem('token', 'token-expirado');
        const onUnauthorized = jest.fn();
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 401,
            headers: { get: () => 'application/json' },
            json: async () => ({ erro: 'Sessão expirada', codigo: 'token_expirado' }),
        });

        render(
            <ApiProvider onUnauthorized={onUnauthorized}>
                <ApiErrorConsumer />
            </ApiProvider>
        );

        fireEvent.click(screen.getByText('erro'));

        await waitFor(() => expect(onUnauthorized).toHaveBeenCalledTimes(1));
        expect(document.body.dataset.errorMessage).toMatch(/Sessão expirada/i);
    });

    test('401 sem token (login errado) mostra mensagem do backend e nao desloga', async () => {
        const onUnauthorized = jest.fn();
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 401,
            headers: { get: () => 'application/json' },
            json: async () => ({ erro: 'Email ou senha incorretos', codigo: 'nao_autenticado' }),
        });

        render(
            <ApiProvider onUnauthorized={onUnauthorized}>
                <ApiErrorConsumer />
            </ApiProvider>
        );

        fireEvent.click(screen.getByText('erro'));

        await waitFor(() => expect(document.body.dataset.errorMessage).toBe('Email ou senha incorretos'));
        expect(onUnauthorized).not.toHaveBeenCalled();
    });

    test('erro HTTP carrega o status da resposta', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 404,
            headers: { get: () => 'application/json' },
            json: async () => ({ erro: 'Mídia não encontrada', codigo: 'nao_encontrado' }),
        });
        let capturado;

        function Consumidor() {
            const { apiCall } = useApi();
            return <button onClick={() => apiCall('/midias/X').catch((e) => { capturado = e; })}>404</button>;
        }

        render(
            <ApiProvider>
                <Consumidor />
            </ApiProvider>
        );

        fireEvent.click(screen.getByText('404'));

        await waitFor(() => expect(capturado).toBeDefined());
        expect(capturado.message).toBe('Mídia não encontrada');
        expect(capturado.status).toBe(404);
        expect(capturado.codigo).toBe('nao_encontrado');
    });

    test('erro de validação carrega codigo e detalhes do envelope', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 400,
            headers: { get: () => 'application/json' },
            json: async () => ({ erro: 'Dados inválidos', codigo: 'dados_invalidos', detalhes: { titulo: 'Campo obrigatório' } }),
        });
        let capturado;

        function Consumidor() {
            const { apiCall } = useApi();
            return <button onClick={() => apiCall('/noticias').catch((e) => { capturado = e; })}>400</button>;
        }

        render(
            <ApiProvider>
                <Consumidor />
            </ApiProvider>
        );

        fireEvent.click(screen.getByText('400'));

        await waitFor(() => expect(capturado).toBeDefined());
        expect(capturado.message).toBe('Dados inválidos');
        expect(capturado.status).toBe(400);
        expect(capturado.codigo).toBe('dados_invalidos');
        expect(capturado.detalhes).toEqual({ titulo: 'Campo obrigatório' });
    });

    test('normaliza erro de rede', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('Failed to fetch'));

        render(
            <ApiProvider>
                <ApiErrorConsumer />
            </ApiProvider>
        );

        fireEvent.click(screen.getByText('erro'));

        await waitFor(() => expect(document.body.dataset.errorMessage).toBe('Erro de conexão com o servidor.'));
    });
});
