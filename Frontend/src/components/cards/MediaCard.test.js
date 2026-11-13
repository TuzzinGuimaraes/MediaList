import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import MediaCard from './MediaCard';


describe('MediaCard', () => {
    test('renderiza titulo preferencial e nota', () => {
        render(
            <MediaCard
                midia={{
                    titulo_portugues: 'Attack on Titan',
                    titulo_original: 'Shingeki no Kyojin',
                    nota_media: 9.1,
                    poster_url: 'poster.jpg',
                }}
                onClick={() => {}}
            />
        );

        expect(screen.getByText('Attack on Titan')).toBeInTheDocument();
        expect(screen.getByAltText('Attack on Titan')).toBeInTheDocument();
    });

    test('usa fallback de titulo_original e chama onClick', () => {
        const onClick = jest.fn();
        render(
            <MediaCard
                midia={{
                    titulo_original: 'Berserk',
                }}
                onClick={onClick}
            />
        );

        fireEvent.click(screen.getByText('Berserk'));
        expect(onClick).toHaveBeenCalledTimes(1);
    });

    test('mostra a Nota dos Usuários e a da fonte com rótulos distintos', () => {
        render(
            <MediaCard
                midia={{ titulo_original: 'Frieren', nota_media: 9.25, nota_fonte: 8.4, origem_nota: 'AniList' }}
                onClick={() => {}}
            />
        );

        expect(screen.getByLabelText('Nota dos Usuários: 9.3')).toBeInTheDocument();
        expect(screen.getByLabelText('Nota AniList: 8.4')).toBeInTheDocument();
    });

    test('sem Avaliações mostra só a Nota da fonte; sem nenhuma, nada', () => {
        const { unmount } = render(
            <MediaCard midia={{ titulo_original: 'Hades', nota_media: null, nota_fonte: 9, origem_nota: 'RAWG' }} />
        );
        expect(screen.getByLabelText('Nota RAWG: 9.0')).toBeInTheDocument();
        expect(screen.queryByLabelText(/^Nota dos Usuários/)).not.toBeInTheDocument();
        unmount();

        render(<MediaCard midia={{ titulo_original: 'Nada', nota_media: null, nota_fonte: null }} />);
        expect(screen.queryByLabelText(/^Nota /)).not.toBeInTheDocument();
    });
});
