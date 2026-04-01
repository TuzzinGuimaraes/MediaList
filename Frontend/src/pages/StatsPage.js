import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Film, Gamepad2, Library } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useApi } from '../contexts/ApiContext';
import { useSession } from '../contexts/SessionContext';
import { STATUS_BADGE_COLORS, STATUS_COLORS } from '../constants/mediaStatus';

const SIDEBAR_CONFIG = {
    animanga: [
        {
            tipo: 'anime',
            label: 'Anime Stats',
            icon: Film,
            sub: [
                { id: 'overview', label: 'Overview' },
                { id: 'genres', label: 'Genres' },
            ],
        },
        {
            tipo: 'manga',
            label: 'Manga Stats',
            icon: Library,
            sub: [
                { id: 'overview', label: 'Overview' },
                { id: 'genres', label: 'Genres' },
            ],
        },
    ],
    jogos: [
        {
            tipo: 'jogo',
            label: 'Game Stats',
            icon: Gamepad2,
            sub: [
                { id: 'overview', label: 'Overview' },
                { id: 'genres', label: 'Genres' },
                { id: 'platforms', label: 'Platforms' },
            ],
        },
    ],
};

const StatsPage = () => {
    const { apiCall } = useApi();
    const { sessao } = useSession();
    const [estatisticas, setEstatisticas] = useState([]);
    const [resumo, setResumo] = useState(null);
    const [lista, setLista] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTipo, setSelectedTipo] = useState(null);
    const [selectedSub, setSelectedSub] = useState('overview');

    const sidebarSections = SIDEBAR_CONFIG[sessao] || SIDEBAR_CONFIG.animanga;
    const tiposDisponiveis = sidebarSections.map(section => section.tipo);
    const tipoAtivo = selectedTipo || tiposDisponiveis[0];
    const secaoAtiva = sidebarSections.find(section => section.tipo === tipoAtivo) || sidebarSections[0];

    useEffect(() => {
        const primeiraSecao = sidebarSections[0];
        setSelectedTipo(primeiraSecao?.tipo || null);
        setSelectedSub(primeiraSecao?.sub?.[0]?.id || 'overview');
    }, [sidebarSections, sessao]);

    const carregarDados = useCallback(async () => {
        setLoading(true);
        try {
            const [statsData, listaData] = await Promise.all([
                apiCall('/usuario/estatisticas').catch(() => ({})),
                apiCall('/lista').catch(() => ({ lista: [] })),
            ]);
            setEstatisticas(statsData.estatisticas || []);
            setResumo(statsData.resumo || null);
            setLista(listaData.lista || []);
        } catch (error) {
            console.error('Erro ao carregar estatísticas:', error);
        } finally {
            setLoading(false);
        }
    }, [apiCall]);

    useEffect(() => {
        carregarDados();
    }, [carregarDados]);

    const listaDoTipo = useMemo(
        () => lista.filter(item => item.tipo === tipoAtivo),
        [lista, tipoAtivo]
    );

    const scoreDistribution = useMemo(() => {
        const buckets = {};
        for (let i = 1; i <= 10; i++) buckets[i] = 0;
        listaDoTipo.forEach(item => {
            const nota = Math.round(Number(item.nota_usuario));
            if (nota >= 1 && nota <= 10) {
                buckets[nota]++;
            }
        });
        return Object.entries(buckets).map(([score, count]) => ({ score: Number(score), count }));
    }, [listaDoTipo]);

    const statusDistribution = useMemo(() => {
        const counts = {};
        listaDoTipo.forEach(item => {
            const currentStatus = item.status_consumo || 'unknown';
            counts[currentStatus] = (counts[currentStatus] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [listaDoTipo]);

    const genreDistribution = useMemo(() => {
        const counts = {};
        listaDoTipo.forEach(item => {
            if (!item.generos) {
                return;
            }

            const generos = typeof item.generos === 'string'
                ? item.generos.split(',')
                : (Array.isArray(item.generos) ? item.generos : []);

            generos.forEach(genero => {
                const name = (typeof genero === 'string' ? genero : genero.nome || '').trim();
                if (name) {
                    counts[name] = (counts[name] || 0) + 1;
                }
            });
        });

        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }));
    }, [listaDoTipo]);

    const platformDistribution = useMemo(() => {
        const counts = {};
        listaDoTipo.forEach(item => {
            if (!item.plataformas) {
                return;
            }

            item.plataformas
                .split(',')
                .map(plataforma => plataforma.trim())
                .filter(Boolean)
                .forEach(plataforma => {
                    counts[plataforma] = (counts[plataforma] || 0) + 1;
                });
        });

        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }));
    }, [listaDoTipo]);

    const tipoStats = useMemo(
        () => estatisticas.find(item => item.tipo === tipoAtivo) || {},
        [estatisticas, tipoAtivo]
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-accent-blue border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="flex gap-6">
            <div className="hidden md:block w-52 flex-shrink-0 space-y-4">
                {sidebarSections.map(section => {
                    const Icon = section.icon;
                    return (
                        <div key={section.tipo} className="space-y-1">
                            <button
                                onClick={() => {
                                    setSelectedTipo(section.tipo);
                                    setSelectedSub(section.sub[0].id);
                                }}
                                className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors ${
                                    tipoAtivo === section.tipo
                                        ? 'bg-dark-tertiary text-accent-blue'
                                        : 'text-text-secondary hover:text-text-primary hover:bg-dark-tertiary/50'
                                }`}
                            >
                                <Icon size={16} />
                                {section.label}
                            </button>

                            <div className="pl-6 space-y-1">
                                {section.sub.map(sub => (
                                    <button
                                        key={`${section.tipo}-${sub.id}`}
                                        onClick={() => {
                                            setSelectedTipo(section.tipo);
                                            setSelectedSub(sub.id);
                                        }}
                                        className={`w-full text-left px-3 py-1.5 rounded text-xs transition-colors ${
                                            tipoAtivo === section.tipo && selectedSub === sub.id
                                                ? 'bg-dark-tertiary text-text-bright'
                                                : 'text-text-secondary hover:text-text-primary hover:bg-dark-tertiary/40'
                                        }`}
                                    >
                                        {sub.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="flex-1 min-w-0 space-y-6">
                <div className="md:hidden space-y-2">
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {sidebarSections.map(section => (
                            <button
                                key={section.tipo}
                                onClick={() => {
                                    setSelectedTipo(section.tipo);
                                    setSelectedSub(section.sub[0].id);
                                }}
                                className={`px-3 py-1.5 rounded text-xs whitespace-nowrap transition-colors ${
                                    tipoAtivo === section.tipo ? 'bg-accent-blue text-white' : 'bg-dark-secondary text-text-secondary'
                                }`}
                            >
                                {section.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {secaoAtiva?.sub.map(sub => (
                            <button
                                key={sub.id}
                                onClick={() => setSelectedSub(sub.id)}
                                className={`px-3 py-1.5 rounded text-xs whitespace-nowrap transition-colors ${
                                    selectedSub === sub.id ? 'bg-dark-tertiary text-text-bright' : 'bg-dark-secondary text-text-secondary'
                                }`}
                            >
                                {sub.label}
                            </button>
                        ))}
                    </div>
                </div>

                {selectedSub === 'overview' && (
                    <>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                            {[
                                { label: 'Total', value: tipoStats.total_midias || 0, color: 'text-accent-blue' },
                                { label: 'Concluídos', value: tipoStats.concluidos || 0, color: 'text-accent-green' },
                                { label: 'Em Andamento', value: tipoStats.em_andamento || 0, color: 'text-accent-orange' },
                                { label: 'Nota Média', value: tipoStats.nota_media ? Number(tipoStats.nota_media).toFixed(1) : 'N/A', color: 'text-accent-yellow' },
                                { label: 'Favoritos', value: tipoStats.favoritos || 0, color: 'text-accent-red' },
                                { label: 'Progresso', value: tipoStats.progresso_total_consumido || 0, color: 'text-text-bright' },
                            ].map((stat, index) => (
                                <div key={index} className="bg-dark-secondary rounded-md p-4 text-center">
                                    <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                                    <p className="text-xs text-text-secondary mt-1">{stat.label}</p>
                                </div>
                            ))}
                        </div>

                        <div className="bg-dark-secondary rounded-md p-5">
                            <h3 className="text-sm font-semibold text-text-bright mb-4">Score Distribution</h3>
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={scoreDistribution}>
                                    <XAxis dataKey="score" tick={{ fill: '#8899aa', fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: '#8899aa', fontSize: 12 }} axisLine={false} tickLine={false} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1a2634', border: '1px solid #253245', borderRadius: '6px', color: '#c7d5e0' }}
                                        cursor={{ fill: 'rgba(61, 180, 242, 0.1)' }}
                                    />
                                    <Bar dataKey="count" fill="#e85d75" radius={[2, 2, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        {statusDistribution.length > 0 && (
                            <div className="bg-dark-secondary rounded-md p-5">
                                <h3 className="text-sm font-semibold text-text-bright mb-4">Status Distribution</h3>
                                <ResponsiveContainer width="100%" height={250}>
                                    <PieChart>
                                        <Pie
                                            data={statusDistribution}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={80}
                                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        >
                                            {statusDistribution.map((entry, index) => (
                                                <Cell key={index} fill={STATUS_COLORS[entry.name] || STATUS_BADGE_COLORS[index % STATUS_BADGE_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1a2634', border: '1px solid #253245', borderRadius: '6px', color: '#c7d5e0' }}
                                        />
                                        <Legend wrapperStyle={{ color: '#8899aa', fontSize: '12px' }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </>
                )}

                {selectedSub === 'genres' && (
                    <div className="bg-dark-secondary rounded-md p-5">
                        <h3 className="text-sm font-semibold text-text-bright mb-4">Genre Distribution</h3>
                        {genreDistribution.length === 0 ? (
                            <p className="text-sm text-text-secondary">Sem gêneros suficientes para exibir distribuição.</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={genreDistribution} layout="vertical">
                                    <XAxis type="number" tick={{ fill: '#8899aa', fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <YAxis dataKey="name" type="category" tick={{ fill: '#8899aa', fontSize: 11 }} axisLine={false} tickLine={false} width={100} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1a2634', border: '1px solid #253245', borderRadius: '6px', color: '#c7d5e0' }}
                                        cursor={{ fill: 'rgba(61, 180, 242, 0.1)' }}
                                    />
                                    <Bar dataKey="count" fill="#3db4f2" radius={[0, 2, 2, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                )}

                {selectedSub === 'platforms' && (
                    <div className="bg-dark-secondary rounded-md p-5">
                        <h3 className="text-sm font-semibold text-text-bright mb-4">Platform Distribution</h3>
                        {platformDistribution.length === 0 ? (
                            <p className="text-sm text-text-secondary">Sem plataformas suficientes para exibir distribuição.</p>
                        ) : (
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={platformDistribution} layout="vertical">
                                    <XAxis type="number" tick={{ fill: '#8899aa', fontSize: 11 }} axisLine={false} tickLine={false} />
                                    <YAxis dataKey="name" type="category" tick={{ fill: '#8899aa', fontSize: 11 }} axisLine={false} tickLine={false} width={120} />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1a2634', border: '1px solid #253245', borderRadius: '6px', color: '#c7d5e0' }}
                                        cursor={{ fill: 'rgba(61, 180, 242, 0.1)' }}
                                    />
                                    <Bar dataKey="count" fill="#8bc34a" radius={[0, 2, 2, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                )}

                {resumo && (
                    <div className="bg-dark-secondary rounded-md p-5">
                        <h3 className="text-sm font-semibold text-text-bright mb-3 flex items-center gap-2">
                            <BarChart3 size={16} className="text-accent-blue" />
                            Resumo Geral
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div>
                                <p className="text-xl font-bold text-accent-blue">{resumo.total_midias || 0}</p>
                                <p className="text-xs text-text-secondary">Total de Mídias</p>
                            </div>
                            <div>
                                <p className="text-xl font-bold text-accent-green">{resumo.concluidos || 0}</p>
                                <p className="text-xs text-text-secondary">Concluídas</p>
                            </div>
                            <div>
                                <p className="text-xl font-bold text-accent-orange">{resumo.em_andamento || 0}</p>
                                <p className="text-xs text-text-secondary">Em Andamento</p>
                            </div>
                            <div>
                                <p className="text-xl font-bold text-accent-red">{resumo.favoritos || 0}</p>
                                <p className="text-xs text-text-secondary">Favoritos</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatsPage;
