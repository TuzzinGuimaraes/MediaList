import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import MediaListPage from './MediaListPage';

jest.mock('../contexts/ApiContext', () => ({
    useApi: jest.fn(),
}));

jest.mock('../components/cards/MediaCard', () => ({ midia, onClick }) => (
    <button onClick={onClick}>{midia.titulo_portugues || midia.titulo_original}</button>
));

jest.mock('../components/media/ListEditorModal', () => ({ isOpen, onSave }) => (
    isOpen ? <button onClick={onSave}>modal-save</button> : null
));

const { useApi } = require('../contexts/ApiContext');


describe('MediaListPage', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('busca lista do usuario, filtra por tipo e por status', async () => {
        useApi.mockReturnValue({
            apiCall: jest.fn().mockResolvedValue({
                lista: [
                    { id_lista: 'L1', tipo: 'anime', status_consumo: 'assistindo', titulo_portugues: 'Anime X' },
                    { id_lista: 'L2', tipo: 'anime', status_consumo: 'completo', titulo_portugues: 'Anime Y' },
                    { id_lista: 'L3', tipo: 'jogo', status_consumo: 'jogando', titulo_portugues: 'Game X' },
                ],
            }),
        });

        render(<MediaListPage tipo="anime" />);

        expect(await screen.findByText('Anime X')).toBeInTheDocument();
        expect(screen.getByText('Anime Y')).toBeInTheDocument();
        expect(screen.queryByText('Game X')).not.toBeInTheDocument();

        fireEvent.click(screen.getAllByText('Watching (1)')[0]);
        expect(screen.getByText('Anime X')).toBeInTheDocument();
        expect(screen.queryByText('Anime Y')).not.toBeInTheDocument();
    });

    test('abre editor e recarrega apos salvar', async () => {
        const apiCall = jest.fn().mockResolvedValue({
            lista: [
                { id_lista: 'L1', tipo: 'anime', status_consumo: 'assistindo', titulo_portugues: 'Anime X' },
            ],
        });
        useApi.mockReturnValue({ apiCall });

        render(<MediaListPage tipo="anime" />);

        fireEvent.click(await screen.findByText('Anime X'));
        fireEvent.click(screen.getByText('modal-save'));

        await waitFor(() => expect(apiCall).toHaveBeenCalledTimes(2));
    });

    test('lida com lista vazia', async () => {
        useApi.mockReturnValue({
            apiCall: jest.fn().mockResolvedValue({ lista: [] }),
        });

        render(<MediaListPage tipo="anime" />);

        expect(await screen.findByText('Nenhuma mídia nesta categoria')).toBeInTheDocument();
    });

    test('falha ao carregar a lista mostra erro em vez de lista vazia', async () => {
        useApi.mockReturnValue({
            apiCall: jest.fn().mockRejectedValue(new Error('Erro de conexão com o servidor.')),
        });

        render(<MediaListPage tipo="anime" />);

        expect(await screen.findByRole('alert')).toHaveTextContent('Erro de conexão com o servidor.');
        expect(screen.queryByText('Nenhuma mídia nesta categoria')).not.toBeInTheDocument();
    });
});
