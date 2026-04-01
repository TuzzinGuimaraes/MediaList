import React from 'react';
import { Star } from 'lucide-react';

const MediaCard = ({ midia, onClick }) => {
    const title = midia.titulo_portugues || midia.titulo_original;
    const score = midia.nota_media ? Number(midia.nota_media).toFixed(1) : null;

    return (
        <div
            className="group cursor-pointer"
            onClick={onClick}
        >
            <div className="relative aspect-[2/3] rounded-md overflow-hidden bg-dark-tertiary mb-2">
                <img
                    src={midia.poster_url || 'https://via.placeholder.com/230x345?text=No+Image'}
                    alt={title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                />
                {/* Score badge */}
                {score && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center gap-1">
                            <Star size={12} className="text-accent-yellow" fill="currentColor" />
                            <span className="text-xs font-semibold text-white">{score}</span>
                        </div>
                    </div>
                )}
                {/* Airing status dot */}
                {(midia.status_anime === 'em_exibicao' || midia.status_catalogo === 'em_exibicao') && (
                    <div className="absolute top-2 left-2 w-2.5 h-2.5 bg-accent-green rounded-full shadow-lg shadow-accent-green/50"></div>
                )}
            </div>
            <h3 className="text-sm font-medium text-text-primary group-hover:text-accent-blue transition-colors line-clamp-2 leading-tight">
                {title}
            </h3>
        </div>
    );
};

export default MediaCard;
