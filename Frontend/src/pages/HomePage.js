import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Film, Gamepad2, Library, TrendingUp } from 'lucide-react';
import { useApi } from '../contexts/ApiContext';
import { useSession } from '../contexts/SessionContext';
import MediaCard from '../components/cards/MediaCard';
import ListEditorModal from '../components/media/ListEditorModal';

const TIPO_CONFIG = {
    anime: { label: 'Anime in Progress', icon: Film, statusKey: 'assistindo' },
    manga: { label: 'Manga in Progress', icon: Library, statusKey: 'lendo' },
    jogo: { label: 'Currently Playing', icon: Gamepad2, statusKey: 'jogando' },
};

const HomePage = () => {
    const { apiCall } = useApi();
    const { sessaoConfig } = useSession();
    const navigate = useNavigate();
    const [lista, setLista] = useState([]);
    const [midias, setMidias] = useState({ trending: [], recent: [] });
    const [loading, setLoading] = useState(true);
    const [editorOpen, setEditorOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);

    const carregarDados = useCallback(async () => {
        setLoading(true);
        try {
            const tipos = sessaoConfig.tipos;

            const requests = [
                apiCall('/lista').catch(() => ({ lista: [] })),
                ...tipos.map(tipo =>
                    apiCall(`/midias?tipo=${tipo}&por_pagina=15&ordem=nota_media`).catch(() => ({ midias: [] }))
                ),
            ];

            const [listaData, ...midiasResults] = await Promise.all(requests);

            setLista(listaData.lista || []);

            const all = midiasResults.flatMap(r => r.midias || []);
            const sorted = [...all].sort((a, b) => (b?.nota_media || 0) - (a?.nota_media || 0));
            const byDate = [...all].sort((a, b) => new Date(b?.data_lancamento || 0) - new Date(a?.data_lancamento || 0));

            setMidias({
                trending: sorted.slice(0, 8),
                recent: byDate.slice(0, 8),
            });
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        } finally {
            setLoading(false);
        }
    }, [apiCall, sessaoConfig]);

    useEffect(() => {
        carregarDados();
    }, [carregarDados]);

    const handleProgressClick = (item) => {
        setSelectedItem(item);
        setEditorOpen(true);
    };

    const handleEditorSave = async () => {
        await carregarDados();
        setEditorOpen(false);
        setSelectedItem(null);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-accent-blue border-t-transparent"></div>
            </div>
        );
    }

    // Agrupar itens em andamento por tipo, apenas dos tipos da sessão ativa
    const inProgress = {};
    sessaoConfig.tipos.forEach(tipo => {
        const config = TIPO_CONFIG[tipo];
        if (!config) return;
        const items = lista.filter(item => item.tipo === tipo && item.status_consumo === config.statusKey);
        if (items.length > 0) inProgress[tipo] = items;
    });

    const hasInProgress = Object.keys(inProgress).length > 0;

    return (
        <div className="space-y-8">
            {/* In Progress Sections */}
            {hasInProgress && Object.entries(inProgress).map(([tipo, items]) => {
                const config = TIPO_CONFIG[tipo];
                const Icon = config.icon;

                return (
                    <section key={tipo}>
                        <h2 className="text-sm font-bold text-text-secondary tracking-wider flex items-center gap-2 mb-3">
                            <Icon size={15} className="text-accent-blue" />
                            {config.label}
                        </h2>
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                            {items.map(item => {
                                const progressTotal = item.progresso_total || item.progresso_total_padrao;
                                const progressCurrent = item.progresso_atual || 0;
                                const progressPct = progressTotal ? Math.min((progressCurrent / progressTotal) * 100, 100) : 0;

                                return (
                                    <div
                                        key={item.id_lista}
                                        className="flex-shrink-0 w-[115px] cursor-pointer group"
                                        onClick={() => handleProgressClick(item)}
                                    >
                                        <div className="relative aspect-[2/3] rounded overflow-hidden bg-dark-tertiary mb-1.5">
                                            <img
                                                src={item.poster_url || 'https://via.placeholder.com/115x170'}
                                                alt={item.titulo_portugues || item.titulo_original}
                                                className="w-full h-full object-cover group-hover:brightness-110 transition-all"
                                                loading="lazy"
                                            />
                                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-2 pb-1.5 pt-4">
                                                <p className="text-[10px] text-white/80 font-medium">
                                                    {progressCurrent}/{progressTotal || '?'}
                                                </p>
                                                {progressTotal > 0 && (
                                                    <div className="w-full h-1 bg-white/20 rounded-full mt-0.5">
                                                        <div
                                                            className="h-full bg-accent-blue rounded-full transition-all"
                                                            style={{ width: `${progressPct}%` }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <p className="text-xs text-text-primary group-hover:text-accent-blue transition-colors line-clamp-2 leading-tight">
                                            {item.titulo_portugues || item.titulo_original}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                );
            })}

            {/* Trending Now */}
            {midias.trending.length > 0 && (
                <section>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-bold text-text-secondary tracking-wider flex items-center gap-2">
                            <TrendingUp size={15} className="text-accent-blue" />
                            TRENDING NOW
                        </h2>
                        <button
                            onClick={() => navigate('/browse')}
                            className="text-xs text-text-secondary hover:text-accent-blue transition-colors"
                        >
                            View All
                        </button>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3">
                        {midias.trending.map(midia => (
                            <MediaCard
                                key={midia.id_midia}
                                midia={midia}
                                onClick={() => navigate(`/media/${midia.id_midia}`)}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Recently Added */}
            {midias.recent.length > 0 && (
                <section>
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-bold text-text-secondary tracking-wider flex items-center gap-2">
                            <Clock size={15} className="text-accent-blue" />
                            ADDED RECENTLY
                        </h2>
                        <button
                            onClick={() => navigate('/browse')}
                            className="text-xs text-text-secondary hover:text-accent-blue transition-colors"
                        >
                            View All
                        </button>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3">
                        {midias.recent.map(midia => (
                            <MediaCard
                                key={midia.id_midia}
                                midia={midia}
                                onClick={() => navigate(`/media/${midia.id_midia}`)}
                            />
                        ))}
                    </div>
                </section>
            )}

            <ListEditorModal
                isOpen={editorOpen}
                onClose={() => { setEditorOpen(false); setSelectedItem(null); }}
                midia={selectedItem}
                listaItem={selectedItem}
                onSave={handleEditorSave}
            />
        </div>
    );
};

export default HomePage;
