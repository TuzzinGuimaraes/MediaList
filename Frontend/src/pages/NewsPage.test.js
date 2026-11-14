import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import NewsPage from './NewsPage';

jest.mock('../contexts/ApiContext', () => ({
    useApi: jest.fn(),
}));

jest.mock('../contexts/AuthContext', () => ({
    useAuth: jest.fn(),
}));

jest.mock('../components/CreateNoticiaModal', () => ({ isOpen, onSave }) => (
    isOpen ? <button onClick={() => onSave({ titulo: 'Nova noticia' })}>modal-create</button> : null
));

const { useApi } = require('../contexts/ApiContext');
const { useAuth } = require('../contexts/AuthContext');


describe('NewsPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('lista noticias e abre modal para usuario autorizado', async () => {
        const apiCall = jest.fn().mockResolvedValue({
            itens: [{ id_noticia: 'NOT-1', titulo: 'Noticia 1', conteudo: 'Texto', autor: 'Admin', data_publicacao: '2026-04-01T12:00:00Z', tags: [] }],
            pagina: 1,
            por_pagina: 20,
            total: 1,
        });
        useApi.mockReturnValue({ apiCall });
        useAuth.mockReturnValue({ user: { nome: 'Admin' }, permissions: { nivel_acesso: 'admin', pode_moderar: true } });

        render(<NewsPage />);

        expect(await screen.findByText('Noticia 1')).toBeInTheDocument();
        expect(apiCall).toHaveBeenCalledWith('/noticias?por_pagina=20');
        fireEvent.click(screen.getByText('Criar Notícia'));
        expect(screen.getByText('modal-create')).toBeInTheDocument();
    });

    test('cria noticia com sucesso', async () => {
        const apiCall = jest.fn()
            .mockResolvedValueOnce({ itens: [], pagina: 1, por_pagina: 20, total: 0 })
            .mockResolvedValueOnce({})
            .mockResolvedValueOnce({ itens: [{ id_noticia: 'NOT-2', titulo: 'Nova noticia', conteudo: 'Texto', autor: 'Admin', data_publicacao: '2026-04-01T12:00:00Z', tags: [] }], pagina: 1, por_pagina: 20, total: 1 });
        useApi.mockReturnValue({ apiCall });
        useAuth.mockReturnValue({ user: { nome: 'Admin' }, permissions: { nivel_acesso: 'admin', pode_moderar: true } });

        render(<NewsPage />);
        await screen.findByText('Nenhuma notícia disponível no momento.');

        fireEvent.click(screen.getByText('Criar Notícia'));
        fireEvent.click(screen.getByText('modal-create'));

        await waitFor(() => expect(apiCall).toHaveBeenCalledWith('/noticias', expect.objectContaining({ method: 'POST' })));
        expect(await screen.findByText('Nova noticia')).toBeInTheDocument();
    });

    test('exibe estado vazio', async () => {
        useApi.mockReturnValue({ apiCall: jest.fn().mockResolvedValue({ itens: [], pagina: 1, por_pagina: 20, total: 0 }) });
        useAuth.mockReturnValue({ user: { nome: 'User' }, permissions: { nivel_acesso: 'usuario', pode_moderar: false } });

        render(<NewsPage />);

        expect(await screen.findByText('Nenhuma notícia disponível no momento.')).toBeInTheDocument();
    });
});
