import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, MessageSquare, Star, User } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useApi } from '../contexts/ApiContext';
import ListEditorModal from '../components/media/ListEditorModal';
import { STATUS_COLORS, STATUS_LABELS } from '../constants/mediaStatus';

const blocoEspecifico = (midia) => {
    switch (midia.tipo) {
        case 'anime':
            return [
                ['Format', 'Anime'],
                ['Episodes', midia.numero_episodios || '?'],
                ['Status', midia.status_anime || '-'],
                ['Start Date', midia.data_lancamento ? new Date(midia.data_lancamento).toLocaleDateString('pt-BR') : '-'],
                ['Studio', midia.estudio || '-'],
                ['Source', midia.fonte_original || '-'],
            ];
        case 'manga':
            return [
                ['Format', 'Mangá'],
                ['Chapters', midia.numero_capitulos || '?'],
                ['Volumes', midia.numero_volumes || '?'],
                ['Status', midia.status_manga || '-'],
                ['Author', midia.autor || '-'],
                ['Demographic', midia.demografia || '-'],
            ];
        case 'jogo':
            return [
                ['Format', 'Jogo'],
                ['Platforms', midia.plataformas || '-'],
                ['Status', midia.status_jogo || '-'],
                ['Developer', midia.desenvolvedor || '-'],
                ['Publisher', midia.publicadora || '-'],
                ['Mode', midia.modo_jogo || '-'],
            ];
        default:
            return [];
    }
};

const MediaDetailPage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { apiCall } = useApi();
    const [midia, setMidia] = useState(null);
    const [avaliacoes, setAvaliacoes] = useState([]);
    const [listaItem, setListaItem] = useState(null);
    const [distribuicao, setDistribuicao] = useState([]);
    const [loading, setLoading] = useState(true);
    const [listEditorOpen, setListEditorOpen] = useState(false);

    const carregarMidia = useCallback(async () => {
        setLoading(true);
        try {
            const [midiaData, avalData, listaData, distData] = await Promise.all([
                apiCall(`/midias/${id}`),
                apiCall(`/avaliacoes/${id}`).catch(() => ({ avaliacoes: [] })),
                apiCall('/lista').catch(() => ({ lista: [] })),
                apiCall(`/midias/${id}/distribuicao`).catch(() => ({ distribuicao: [] })),
            ]);

            const m = midiaData.id_midia ? midiaData : (midiaData.midia || midiaData);
            if (!m.generos && m.generos_lista) {
                m.generos = m.generos_lista;
            } else if (typeof m.generos === 'string' && m.generos) {
                m.generos = m.generos.split(',').map(g => g.trim()).filter(Boolean);
            }
            setMidia(m);
            setAvaliacoes(avalData.avaliacoes || []);
            setDistribuicao(distData.distribuicao || []);

            const lista = listaData.lista || [];
            const item = lista.find(i => i.id_midia === id);
            setListaItem(item || null);
        } catch (error) {
            console.error('Erro ao carregar mídia:', error);
        } finally {
            setLoading(false);
        }
    }, [apiCall, id]);

    useEffect(() => {
        carregarMidia();
    }, [carregarMidia]);

    const handleListSave = async () => {
        await carregarMidia();
        setListEditorOpen(false);
    };

    // Score distribution (1-10 buckets)
    const scoreDistribution = useMemo(() => {
        const buckets = {};
        for (let i = 1; i <= 10; i++) buckets[i] = 0;
        avaliacoes.forEach(av => {
            const nota = Math.round(Number(av.nota));
            if (nota >= 1 && nota <= 10) buckets[nota]++;
        });
        return Object.entries(buckets).map(([score, count]) => ({ score: Number(score), count }));
    }, [avaliacoes]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-accent-blue border-t-transparent"></div>
            </div>
        );
    }

    if (!midia) {
        return (
            <div className="text-center py-20">
                <p className="text-text-secondary">Mídia não encontrada</p>
                <button onClick={() => navigate(-1)} className="text-accent-blue mt-4 text-sm">Voltar</button>
            </div>
        );
    }

    const detalhes = blocoEspecifico(midia);
    const score = midia.nota_media ? Number(midia.nota_media).toFixed(1) : null;
    const totalDistribuicao = distribuicao.reduce((acc, d) => acc + (d.total || 0), 0);

    return (
        <>
            <div className="space-y-6">
                {/* Banner */}
                <div className="relative -mx-4 -mt-8 h-64 md:h-80 overflow-hidden">
                    <img
                        src={midia.banner_url || midia.poster_url || 'https://via.placeholder.com/1200x400'}
                        alt=""
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-dark-primary via-dark-primary/60 to-transparent" />
                    <button
                        onClick={() => navigate(-1)}
                        className="absolute top-4 left-4 p-2 bg-black/40 hover:bg-black/60 rounded-lg transition-colors backdrop-blur-sm text-white"
                    >
                        <ArrowLeft size={20} />
                    </button>
                </div>

                {/* Header Section */}
                <div className="flex gap-6 -mt-24 relative z-10">
                    {/* Cover */}
                    <div className="flex-shrink-0 w-40 md:w-52">
                        <img
                            src={midia.poster_url || 'https://via.placeholder.com/230x345'}
                            alt={midia.titulo_portugues || midia.titulo_original}
                            className="w-full aspect-[2/3] object-cover rounded-md shadow-xl"
                        />
                        <button
                            onClick={() => setListEditorOpen(true)}
                            className={`w-full mt-3 py-2.5 rounded-md font-semibold text-sm transition-colors ${
                                listaItem
                                    ? 'bg-accent-blue/20 text-accent-blue border border-accent-blue/30 hover:bg-accent-blue/30'
                                    : 'bg-accent-blue hover:bg-accent-blue-hover text-white'
                            }`}
                        >
                            {listaItem ? 'Editar na Lista' : 'Adicionar à Lista'}
                        </button>
                    </div>

                    {/* Info */}
                    <div className="flex-1 pt-20 md:pt-16">
                        <h1 className="text-2xl md:text-3xl font-bold text-text-bright mb-1">
                            {midia.titulo_portugues || midia.titulo_original}
                        </h1>
                        {midia.titulo_original && midia.titulo_portugues !== midia.titulo_original && (
                            <p className="text-sm text-text-secondary mb-4">{midia.titulo_original}</p>
                        )}

                        {/* Stats Row */}
                        <div className="flex flex-wrap gap-4 mb-4">
                            {score && (
                                <div className="flex items-center gap-1.5">
                                    <Star size={16} className="text-accent-yellow" fill="currentColor" />
                                    <span className="font-bold text-text-bright">{score}</span>
                                    <span className="text-xs text-text-secondary">Nota Média</span>
                                </div>
                            )}
                            <div className="flex items-center gap-1.5">
                                <MessageSquare size={16} className="text-accent-blue" />
                                <span className="font-bold text-text-bright">{avaliacoes.length}</span>
                                <span className="text-xs text-text-secondary">Avaliações</span>
                            </div>
                            {midia.total_usuarios > 0 && (
                                <div className="flex items-center gap-1.5">
                                    <User size={16} className="text-text-secondary" />
                                    <span className="font-bold text-text-bright">{midia.total_usuarios}</span>
                                    <span className="text-xs text-text-secondary">na lista</span>
                                </div>
                            )}
                            {midia.data_lancamento && (
                                <div className="flex items-center gap-1.5">
                                    <Calendar size={16} className="text-text-secondary" />
                                    <span className="text-sm text-text-secondary">
                                        {new Date(midia.data_lancamento).toLocaleDateString('pt-BR')}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Synopsis */}
                        {midia.sinopse && (
                            <p className="text-sm text-text-primary leading-relaxed max-w-3xl">
                                {midia.sinopse}
                            </p>
                        )}
                    </div>
                </div>

                {/* Details + Main Content */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6">
                    {/* Sidebar - Details */}
                    <div className="lg:col-span-1 space-y-4">
                        <div className="bg-dark-secondary rounded-md p-4 space-y-3">
                            {detalhes.map(([label, value]) => (
                                <div key={label}>
                                    <span className="text-xs text-text-secondary uppercase tracking-wide">{label}</span>
                                    <p className="text-sm text-text-bright capitalize">{value}</p>
                                </div>
                            ))}
                            {midia.generos && midia.generos.length > 0 && (
                                <div>
                                    <span className="text-xs text-text-secondary uppercase tracking-wide">Gêneros</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {midia.generos.map((g, i) => (
                                            <span key={i} className="bg-accent-blue/15 text-accent-blue text-xs px-2 py-0.5 rounded">
                                                {typeof g === 'string' ? g : g.nome}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {midia.total_usuarios > 0 && (
                                <div>
                                    <span className="text-xs text-text-secondary uppercase tracking-wide">Popularity</span>
                                    <p className="text-sm text-text-bright">{midia.total_usuarios}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="lg:col-span-3 space-y-6">
                        {/* Status Distribution */}
                        {distribuicao.length > 0 && (
                            <div className="bg-dark-secondary rounded-md p-5">
                                <h3 className="text-sm font-semibold text-text-bright mb-4">Status Distribution</h3>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {distribuicao.map(d => (
                                        <div
                                            key={d.status_consumo}
                                            className="px-3 py-1.5 rounded text-xs font-semibold text-white"
                                            style={{ backgroundColor: STATUS_COLORS[d.status_consumo] || '#8899aa' }}
                                        >
                                            {STATUS_LABELS[d.status_consumo] || d.status_consumo}: {d.total}
                                        </div>
                                    ))}
                                </div>
                                {totalDistribuicao > 0 && (
                                    <div className="w-full h-2 bg-dark-tertiary rounded-full overflow-hidden flex">
                                        {distribuicao.map(d => (
                                            <div
                                                key={d.status_consumo}
                                                className="h-full transition-all"
                                                style={{
                                                    width: `${(d.total / totalDistribuicao) * 100}%`,
                                                    backgroundColor: STATUS_COLORS[d.status_consumo] || '#8899aa',
                                                }}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Score Distribution */}
                        {avaliacoes.length > 0 && (
                            <div className="bg-dark-secondary rounded-md p-5">
                                <h3 className="text-sm font-semibold text-text-bright mb-4">Score Distribution</h3>
                                <ResponsiveContainer width="100%" height={180}>
                                    <BarChart data={scoreDistribution}>
                                        <XAxis dataKey="score" tick={{ fill: '#8899aa', fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fill: '#8899aa', fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1a2634', border: '1px solid #253245', borderRadius: '6px', color: '#c7d5e0' }}
                                            cursor={{ fill: 'rgba(61, 180, 242, 0.1)' }}
                                        />
                                        <Bar dataKey="count" fill="#e85d75" radius={[2, 2, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {/* Reviews */}
                        <div>
                            <h3 className="text-lg font-semibold text-text-bright mb-4">
                                {avaliacoes.length > 0 ? `Avaliações (${avaliacoes.length})` : 'Sem avaliações'}
                            </h3>
                            {avaliacoes.length === 0 ? (
                                <div className="bg-dark-secondary rounded-md p-8 text-center">
                                    <MessageSquare size={40} className="mx-auto text-text-secondary mb-2 opacity-40" />
                                    <p className="text-text-secondary text-sm">Nenhuma avaliação ainda.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {avaliacoes.slice(0, 10).map(av => (
                                        <div key={av.id_avaliacao} className="bg-dark-secondary rounded-md p-4">
                                            <div className="flex items-start justify-between mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 bg-dark-tertiary rounded-full flex items-center justify-center text-text-secondary border border-dark-border">
                                                        {av.foto_perfil ? (
                                                            <img src={av.foto_perfil} alt="" className="w-full h-full rounded-full object-cover" />
                                                        ) : (
                                                            <User size={14} />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-text-bright">{av.nome_completo}</p>
                                                        <p className="text-xs text-text-secondary">
                                                            {new Date(av.data_avaliacao).toLocaleDateString('pt-BR')}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 bg-accent-yellow/10 px-2 py-0.5 rounded">
                                                    <Star size={12} className="text-accent-yellow" fill="currentColor" />
                                                    <span className="text-sm font-bold text-accent-yellow">{av.nota}</span>
                                                </div>
                                            </div>
                                            {av.titulo_avaliacao && (
                                                <h4 className="text-sm font-semibold text-text-bright mb-1">{av.titulo_avaliacao}</h4>
                                            )}
                                            {av.texto_avaliacao && (
                                                <p className="text-sm text-text-primary leading-relaxed">
                                                    {av.texto_avaliacao.length > 300
                                                        ? `${av.texto_avaliacao.substring(0, 300)}...`
                                                        : av.texto_avaliacao}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <ListEditorModal
                isOpen={listEditorOpen}
                onClose={() => setListEditorOpen(false)}
                midia={midia}
                listaItem={listaItem}
                onSave={handleListSave}
            />
        </>
    );
};

export default MediaDetailPage;
