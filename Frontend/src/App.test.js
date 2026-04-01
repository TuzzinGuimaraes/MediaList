import { render, screen } from '@testing-library/react';
import MediaCard from './components/cards/MediaCard';

test('renders media card title', () => {
    render(
        <MediaCard
            midia={{
                id_midia: 'MID-ANM-2026-00001',
                titulo_portugues: 'Attack on Titan',
                titulo_original: 'Shingeki no Kyojin',
                nota_media: 9.1,
            }}
            onClick={() => {}}
        />
    );

    expect(screen.getByText('Attack on Titan')).toBeInTheDocument();
});
