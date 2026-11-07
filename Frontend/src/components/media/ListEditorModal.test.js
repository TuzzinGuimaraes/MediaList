import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import ListEditorModal from './ListEditorModal';

jest.mock('../../contexts/ApiContext', () => ({
    useApi: jest.fn(),
}));

const { useApi } = require('../../contexts/ApiContext');

const midiaAnime = {
    id_midia: 'MID-1',
    tipo: 'anime',
    titulo_portugues: 'Anime X',
    numero_episodios: 24,
};


describe('ListEditorModal', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useApi.mockReturnValue({ apiCall: jest.fn().mockResolvedValue({}) });
    });

    test('inicializa com valores default ao adicionar item novo', () => {
        render(
            <ListEditorModal isOpen={true} onClose={() => {}} midia={midiaAnime} listaItem={null} onSave={() => {}} />
        );

        expect(screen.getByDisplayValue('Planning')).toBeInTheDocument();
        expect(screen.getByText('Episode Progress')).toBeInTheDocument();
        expect(screen.getByText('Total Rewatches')).toBeInTheDocument();
    });

    test('preenche formulario ao editar item existente e monta payload correto', async () => {
        const apiCall = jest.fn().mockResolvedValue({});
        const onSave = jest.fn();
        useApi.mockReturnValue({ apiCall });

        render(
            <ListEditorModal
                isOpen={true}
                onClose={() => {}}
                midia={midiaAnime}
                listaItem={{
                    id_lista: 'LST-1',
                    status_consumo: 'assistindo',
                    nota_usuario: 8.5,
                    progresso_atual: 7,
                    favorito: true,
                    data_inicio: '2026-04-01T00:00:00',
                    data_conclusao: '2026-04-10T00:00:00',
                    total_rewatches: 1,
                    comentario: 'Muito bom',
                    privado: true,
                }}
                onSave={onSave}
            />
        );

        fireEvent.click(screen.getByText('Save'));

        await waitFor(() => expect(apiCall).toHaveBeenCalledTimes(1));
        expect(apiCall).toHaveBeenCalledWith('/lista/LST-1', expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify({
                status_consumo: 'assistindo',
                nota_usuario: 8.5,
                progresso_atual: 7,
                favorito: true,
                data_inicio: '2026-04-01',
                data_conclusao: '2026-04-10',
                total_rewatches: 1,
                comentario: 'Muito bom',
                privado: true,
            }),
        }));
        expect(onSave).toHaveBeenCalledTimes(1);
    });

    test('monta payload correto para criacao e impede submit duplicado enquanto saving', async () => {
        let resolveRequest;
        const apiCall = jest.fn().mockImplementation(() => new Promise((resolve) => {
            resolveRequest = resolve;
        }));
        useApi.mockReturnValue({ apiCall });

        render(
            <ListEditorModal isOpen={true} onClose={() => {}} midia={midiaAnime} listaItem={null} onSave={() => {}} />
        );

        fireEvent.change(screen.getByPlaceholderText('0'), { target: { value: '9' } });
        fireEvent.change(screen.getAllByRole('spinbutton')[1], { target: { value: '12' } });

        fireEvent.click(screen.getByText('Save'));
        fireEvent.click(screen.getByText('Saving...'));

        expect(apiCall).toHaveBeenCalledTimes(1);
        expect(apiCall).toHaveBeenCalledWith('/lista/adicionar', expect.objectContaining({
            method: 'POST',
        }));
        expect(JSON.parse(apiCall.mock.calls[0][1].body)).toEqual({
            id_midia: 'MID-1',
            status: 'planejado',
            nota_usuario: 9,
            progresso_atual: 12,
            favorito: false,
            data_inicio: null,
            data_conclusao: null,
            total_rewatches: 0,
            comentario: null,
            privado: false,
        });

        resolveRequest({});
        await screen.findByText('Save');
    });

    test('editor de jogo oferece Pausado e salva pausado', async () => {
        const apiCall = jest.fn().mockResolvedValue({});
        useApi.mockReturnValue({ apiCall });

        render(
            <ListEditorModal isOpen={true} onClose={() => {}} midia={{ ...midiaAnime, tipo: 'jogo' }} listaItem={null} onSave={() => {}} />
        );

        const select = screen.getByDisplayValue('Backlog');
        fireEvent.change(select, { target: { value: 'pausado' } });
        expect(screen.getByDisplayValue('Paused')).toBeInTheDocument();

        fireEvent.click(screen.getByText('Save'));

        await waitFor(() => expect(apiCall).toHaveBeenCalledTimes(1));
        expect(JSON.parse(apiCall.mock.calls[0][1].body).status).toBe('pausado');
    });

    test('trata erro da API', async () => {
        useApi.mockReturnValue({ apiCall: jest.fn().mockRejectedValue(new Error('Falha na API')) });

        render(
            <ListEditorModal isOpen={true} onClose={() => {}} midia={{ ...midiaAnime, tipo: 'jogo' }} listaItem={null} onSave={() => {}} />
        );

        fireEvent.click(screen.getByText('Save'));

        await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Erro: Falha na API'));
        expect(screen.getByText('Total Replays')).toBeInTheDocument();
        expect(screen.getByText('Hours Played')).toBeInTheDocument();
    });
});
