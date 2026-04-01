import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Grid3X3, List, Search } from 'lucide-react';
import { useApi } from '../contexts/ApiContext';
import MediaCard from '../components/cards/MediaCard';
import ListEditorModal from '../components/media/ListEditorModal';

const STATUS_POR_TIPO = {
    anime: [
        { value: 'assistindo', label: 'Watching' },
        { value: 'completo', label: 'Completed' },
        { value: 'planejado', label: 'Planning' },
        { value: 'pausado', label: 'Paused' },
        { value: 'abandonado', label: 'Dropped' },
    ],
    manga: [
        { value: 'lendo', label: 'Reading' },
        { value: 'lido', label: 'Completed' },
        { value: 'planejado', label: 'Planning' },
        { value: 'pausado', label: 'Paused' },
        { value: 'abandonado', label: 'Dropped' },
    ],
    jogo: [
        { value: 'jogando', label: 'Playing' },
        { value: 'zerado', label: 'Completed' },
        { value: 'platinado', label: 'Platinum' },
        { value: 'na_fila', label: 'Backlog' },
        { value: 'abandonado', label: 'Dropped' },
    ],
};

const TIPO_LABELS = {
    anime: 'Anime List',
    manga: 'Manga List',
    jogo: 'Game List',
};

const MediaListPage = ({ tipo }) => {
    const { apiCall } = useApi();
    const [lista, setLista] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtroStatus, setFiltroStatus] = useState('all');
    const [busca, setBusca] = useState('');
    const [viewMode, setViewMode] = useState('grid');
    const [editorOpen, setEditorOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);

    const carregarLista = useCallback(async () => {
        setLoading(true);
        try {
            const data = await apiCall('/lista');
            setLista(data.lista || []);
        } catch (error) {
            console.error('Erro ao carregar lista:', error);
        } finally {
            setLoading(false);
        }
    }, [apiCall]);

    useEffect(() => {
        carregarLista();
    }, [carregarLista]);

    const listaDoTipo = useMemo(
        () => lista.filter(item => item.tipo === tipo),
        [lista, tipo]
    );

    const listaFiltrada = useMemo(() => {
        let result = listaDoTipo;
        if (filtroStatus !== 'all') {
            result = result.filter(item => item.status_consumo === filtroStatus);
        }
        if (busca) {
            const q = busca.toLowerCase();
            result = result.filter(item =>
                (item.titulo_portugues || '').toLowerCase().includes(q) ||
                (item.titulo_original || '').toLowerCase().includes(q)
            );
        }
        return result;
    }, [listaDoTipo, filtroStatus, busca]);

    const statusOptions = STATUS_POR_TIPO[tipo] || [];

    const statusCounts = useMemo(() => {
        const counts = {};
        listaDoTipo.forEach(item => {
            counts[item.status_consumo] = (counts[item.status_consumo] || 0) + 1;
        });
        return counts;
    }, [listaDoTipo]);

    const handleCardClick = (item) => {
        setSelectedItem(item);
        setEditorOpen(true);
    };

    const handleEditorSave = async () => {
        await carregarLista();
        setEditorOpen(false);
        setSelectedItem(null);
    };

    return (
        <div className="flex gap-6">
            {/* Sidebar */}
            <div className="hidden md:block w-48 flex-shrink-0 space-y-4">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary" size={14} />
                    <input
                        type="text"
                        placeholder="Filter"
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 bg-dark-secondary border border-dark-border rounded text-xs text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent-blue"
                    />
                </div>

                {/* Status List */}
                <div>
                    <h4 className="text-xs text-text-secondary uppercase tracking-wider mb-2">Lists</h4>
                    <div className="space-y-0.5">
                        <button
                            onClick={() => setFiltroStatus('all')}
                            className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                                filtroStatus === 'all' ? 'bg-dark-tertiary text-accent-blue' : 'text-text-secondary hover:text-text-primary hover:bg-dark-tertiary/50'
                            }`}
                        >
                            All ({listaDoTipo.length})
                        </button>
                        {statusOptions.map(s => (
                            <button
                                key={s.value}
                                onClick={() => setFiltroStatus(s.value)}
                                className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
                                    filtroStatus === s.value ? 'bg-dark-tertiary text-accent-blue' : 'text-text-secondary hover:text-text-primary hover:bg-dark-tertiary/50'
                                }`}
                            >
                                {s.label} ({statusCounts[s.value] || 0})
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-bold text-text-bright">{TIPO_LABELS[tipo]}</h2>
                        {filtroStatus !== 'all' && (
                            <p className="text-xs text-text-secondary capitalize mt-0.5">
                                {statusOptions.find(s => s.value === filtroStatus)?.label} — {listaFiltrada.length} titles
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-1.5 rounded transition-colors ${viewMode === 'grid' ? 'text-accent-blue' : 'text-text-secondary hover:text-text-primary'}`}
                        >
                            <Grid3X3 size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded transition-colors ${viewMode === 'list' ? 'text-accent-blue' : 'text-text-secondary hover:text-text-primary'}`}
                        >
                            <List size={18} />
                        </button>
                    </div>
                </div>

                {/* Mobile Status Filter */}
                <div className="md:hidden flex gap-2 overflow-x-auto pb-3 mb-4">
                    <button
                        onClick={() => setFiltroStatus('all')}
                        className={`px-3 py-1.5 rounded text-xs whitespace-nowrap transition-colors ${
                            filtroStatus === 'all' ? 'bg-accent-blue text-white' : 'bg-dark-secondary text-text-secondary'
                        }`}
                    >
                        All ({listaDoTipo.length})
                    </button>
                    {statusOptions.map(s => (
                        <button
                            key={s.value}
                            onClick={() => setFiltroStatus(s.value)}
                            className={`px-3 py-1.5 rounded text-xs whitespace-nowrap transition-colors ${
                                filtroStatus === s.value ? 'bg-accent-blue text-white' : 'bg-dark-secondary text-text-secondary'
                            }`}
                        >
                            {s.label} ({statusCounts[s.value] || 0})
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-4 border-accent-blue border-t-transparent"></div>
                    </div>
                ) : listaFiltrada.length === 0 ? (
                    <div className="text-center py-20">
                        <p className="text-text-secondary text-sm">Nenhuma mídia nesta categoria</p>
                    </div>
                ) : viewMode === 'grid' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {listaFiltrada.map(item => (
                            <MediaCard
                                key={item.id_lista}
                                midia={item}
                                onClick={() => handleCardClick(item)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {listaFiltrada.map(item => (
                            <div
                                key={item.id_lista}
                                onClick={() => handleCardClick(item)}
                                className="flex items-center gap-3 bg-dark-secondary rounded p-2 cursor-pointer hover:bg-dark-tertiary transition-colors"
                            >
                                <img
                                    src={item.poster_url || 'https://via.placeholder.com/40x60'}
                                    alt=""
                                    className="w-10 h-14 object-cover rounded"
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-text-bright truncate">
                                        {item.titulo_portugues || item.titulo_original}
                                    </p>
                                    <p className="text-xs text-text-secondary capitalize">{item.status_consumo}</p>
                                </div>
                                <div className="text-xs text-text-secondary">
                                    {item.progresso_atual || 0}/{item.progresso_total || item.progresso_total_padrao || '?'}
                                </div>
                                {item.nota_usuario && (
                                    <div className="text-xs text-accent-yellow font-semibold">{item.nota_usuario}</div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* List Editor Modal */}
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

// Per-type page exports
export const AnimeListPage = () => <MediaListPage tipo="anime" />;
export const MangaListPage = () => <MediaListPage tipo="manga" />;
export const GameListPage = () => <MediaListPage tipo="jogo" />;

export default MediaListPage;
