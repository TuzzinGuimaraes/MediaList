import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useApi } from '../contexts/ApiContext';
import MediaListPage from './MediaListPage';
import StatsPage from './StatsPage';

const ABAS = [
    { id: 'overview', label: 'Overview' },
    { id: 'anime-list', label: 'Anime List' },
    { id: 'manga-list', label: 'Manga List' },
    { id: 'game-list', label: 'Game List' },
    { id: 'stats', label: 'Stats' },
];

const ProfilePage = () => {
    const { user } = useAuth();
    const { apiCall } = useApi();
    const navigate = useNavigate();
    const [abaAtiva, setAbaAtiva] = useState('overview');
    const [resumo, setResumo] = useState(null);
    const [lista, setLista] = useState([]);
    const [loading, setLoading] = useState(true);

    const carregarDados = useCallback(async () => {
        setLoading(true);
        try {
            const [statsData, listaData] = await Promise.all([
                apiCall('/usuario/estatisticas').catch(() => ({})),
                apiCall('/lista').catch(() => ({ lista: [] })),
            ]);
            setResumo(statsData.resumo || null);
            setLista(listaData.lista || []);
        } catch (error) {
            console.error('Erro:', error);
        } finally {
            setLoading(false);
        }
    }, [apiCall]);

    useEffect(() => {
        carregarDados();
    }, [carregarDados]);

    const favoritos = useMemo(
        () => lista.filter(item => item.favorito).slice(0, 8),
        [lista]
    );

    const genreCounts = useMemo(() => {
        const counts = {};
        lista.forEach(item => {
            if (item.generos) {
                const generos = typeof item.generos === 'string' ? item.generos.split(',') : (Array.isArray(item.generos) ? item.generos : []);
                generos.forEach(g => {
                    const name = (typeof g === 'string' ? g : g.nome || '').trim();
                    if (name) counts[name] = (counts[name] || 0) + 1;
                });
            }
        });
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6);
    }, [lista]);

    const GENRE_COLORS = ['#3db4f2', '#e85d75', '#ef881a', '#4caf50', '#f7c948', '#8bc34a'];

    const abaClass = (id) =>
        `px-4 py-2 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
            abaAtiva === id
                ? 'border-accent-blue text-accent-blue'
                : 'border-transparent text-text-secondary hover:text-text-bright hover:border-dark-border'
        }`;

    return (
        <div className="space-y-6">
            {/* Profile Header */}
            <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-dark-tertiary rounded-full flex items-center justify-center text-2xl font-bold text-accent-blue border-2 border-dark-border">
                    {user?.nome?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-text-bright">{user?.nome || user?.nome_completo}</h1>
                    <p className="text-sm text-text-secondary">
                        Membro desde {user?.data_criacao ? new Date(user.data_criacao).toLocaleDateString('pt-BR') : '—'}
                    </p>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-dark-border">
                <div className="flex overflow-x-auto">
                    {ABAS.map(aba => (
                        <button
                            key={aba.id}
                            onClick={() => setAbaAtiva(aba.id)}
                            className={abaClass(aba.id)}
                        >
                            {aba.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            {loading && abaAtiva === 'overview' ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-accent-blue border-t-transparent"></div>
                </div>
            ) : (
                <>
                    {/* Overview */}
                    {abaAtiva === 'overview' && (
                        <div className="space-y-8">
                            {/* Stats Summary */}
                            {resumo && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <div className="bg-dark-secondary rounded-md p-4 text-center">
                                        <p className="text-2xl font-bold text-accent-blue">{resumo.total_midias || 0}</p>
                                        <p className="text-xs text-text-secondary">Total</p>
                                    </div>
                                    <div className="bg-dark-secondary rounded-md p-4 text-center">
                                        <p className="text-2xl font-bold text-accent-green">{resumo.concluidos || 0}</p>
                                        <p className="text-xs text-text-secondary">Concluídos</p>
                                    </div>
                                    <div className="bg-dark-secondary rounded-md p-4 text-center">
                                        <p className="text-2xl font-bold text-accent-orange">{resumo.em_andamento || 0}</p>
                                        <p className="text-xs text-text-secondary">Em Andamento</p>
                                    </div>
                                    <div className="bg-dark-secondary rounded-md p-4 text-center">
                                        <p className="text-2xl font-bold text-accent-red">{resumo.favoritos || 0}</p>
                                        <p className="text-xs text-text-secondary">Favoritos</p>
                                    </div>
                                </div>
                            )}

                            {/* Genre Overview */}
                            {genreCounts.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-semibold text-text-bright mb-3">Genre Overview</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {genreCounts.map(([name, count], i) => (
                                            <div key={name} className="text-center">
                                                <span
                                                    className="inline-block px-3 py-1 rounded-full text-xs font-semibold text-white"
                                                    style={{ backgroundColor: GENRE_COLORS[i % GENRE_COLORS.length] }}
                                                >
                                                    {name}
                                                </span>
                                                <p className="text-xs text-text-secondary mt-1">{count} Entries</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Favorites */}
                            {favoritos.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-semibold text-text-bright mb-3">Favoritos</h3>
                                    <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                                        {favoritos.map(item => (
                                            <div
                                                key={item.id_lista}
                                                className="cursor-pointer group"
                                                onClick={() => navigate(`/media/${item.id_midia}`)}
                                            >
                                                <img
                                                    src={item.poster_url || 'https://via.placeholder.com/100x150'}
                                                    alt={item.titulo_portugues || item.titulo_original}
                                                    className="w-full aspect-[2/3] object-cover rounded group-hover:opacity-80 transition-opacity"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Anime List */}
                    {abaAtiva === 'anime-list' && <MediaListPage tipo="anime" />}

                    {/* Manga List */}
                    {abaAtiva === 'manga-list' && <MediaListPage tipo="manga" />}

                    {/* Game List */}
                    {abaAtiva === 'game-list' && <MediaListPage tipo="jogo" />}

                    {/* Stats */}
                    {abaAtiva === 'stats' && <StatsPage />}
                </>
            )}
        </div>
    );
};

export default ProfilePage;
