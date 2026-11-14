import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import CreateNoticiaModal from './CreateNoticiaModal';


describe('CreateNoticiaModal', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('nao renderiza quando fechado', () => {
        const { container } = render(
            <CreateNoticiaModal isOpen={false} onClose={() => {}} onSave={() => {}} userName="Admin" />
        );

        expect(container).toBeEmptyDOMElement();
    });

    test('envia payload esperado e limpa formulario ao fechar', async () => {
        const onSave = jest.fn().mockResolvedValue(undefined);
        const onClose = jest.fn();

        render(
            <CreateNoticiaModal isOpen={true} onClose={onClose} onSave={onSave} userName="Moderador" />
        );

        fireEvent.change(screen.getByPlaceholderText('Digite o título'), { target: { value: 'Nova notícia' } });
        fireEvent.change(screen.getByPlaceholderText('Digite o conteúdo'), { target: { value: 'Conteúdo importante' } });
        fireEvent.change(screen.getByPlaceholderText('anime, ação'), { target: { value: 'anime, acao' } });

        fireEvent.click(screen.getByText('Publicar'));

        await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
        expect(onSave).toHaveBeenCalledWith({
            titulo: 'Nova notícia',
            conteudo: 'Conteúdo importante',
            categoria: 'geral',
            tags: ['anime', 'acao'],
            imagem_url: '',
        });
        expect(onClose).toHaveBeenCalled();
    });

    test('exibe erro quando onSave falha', async () => {
        const onSave = jest.fn().mockRejectedValue(new Error('Falha ao salvar'));

        render(
            <CreateNoticiaModal isOpen={true} onClose={() => {}} onSave={onSave} userName="Admin" />
        );

        fireEvent.change(screen.getByPlaceholderText('Digite o título'), { target: { value: 'Nova notícia' } });
        fireEvent.click(screen.getByText('Publicar'));

        expect(await screen.findByText('Falha ao salvar')).toBeInTheDocument();
    });
});
