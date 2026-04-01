import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useApi } from '../contexts/ApiContext';
import { useSession } from '../contexts/SessionContext';
import MediaCard from '../components/cards/MediaCard';
import {
    ANIME_STATUS_OPTIONS,
    JOGO_MODO_OPTIONS,
    JOGO_STATUS_OPTIONS,
    MANGA_DEMOGRAFIA_OPTIONS,
    MANGA_STATUS_OPTIONS,
} from '../constants/mediaOptions';

const ORDEM_OPTIONS = [
    { value: 'nota_media', label: 'Nota Média' },
    { value: 'titulo', label: 'Título' },
    { value: 'data_lancamento', label: 'Lançamento' },
    { value: 'mais_adicionados', label: 'Mais Adicionados' },
];

const FILTER_KEYS_BY_TYPE = {
    anime: ['status', 'estudio'],
    manga: ['status', 'demografia', 'autor'],
    jogo: ['status', 'plataforma', 'modo_jogo', 'desenvolvedor'],
};

const BrowsePage = () => {
    const { apiCall } = useApi();
    const { sessaoConfig } = useSession();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [midias, setMidias] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generos, setGeneros] = useState([]);

    const tiposDisponiveis = sessaoConfig.tipos;
    const tipoParam = searchParams.get('tipo');
    const tipo = tiposDisponiveis.includes(tipoParam) ? tipoParam : tiposDisponiveis[0];

    const busca = searchParams.get('q') || '';
    const genero = searchParams.get('genero') || '';
    const ordem = searchParams.get('ordem') || 'nota_media';
    const status = searchParams.get('status') || '';
    const demografia = searchParams.get('demografia') || '';
    const autor = searchParams.get('autor') || '';
    const estudio = searchParams.get('estudio') || '';
    const plataforma = searchParams.get('plataforma') || '';
    const modoJogo = searchParams.get('modo_jogo') || '';
    const desenvolvedor = searchParams.get('desenvolvedor') || '';

    const updateParam = useCallback((key, value) => {
        const params = new URLSearchParams(searchParams);
        if (value) {
            params.set(key, value);
        } else {
            params.delete(key);
        }
        setSearchParams(params);
    }, [searchParams, setSearchParams]);

    const setTipo = (novoTipo) => {
        const params = new URLSearchParams(searchParams);
        params.set('tipo', novoTipo);
        Object.values(FILTER_KEYS_BY_TYPE).flat().forEach(key => params.delete(key));
        params.delete('genero');
        setSearchParams(params);
    };

    const carregarDados = useCallback(async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams({ tipo, por_pagina: '200', ordem });
            if (busca && busca.length >= 2) query.set('busca', busca);
            if (genero) query.set('genero', genero);
            if (status) query.set('status', status);
            if (demografia) query.set('demografia', demografia);
            if (autor) query.set('autor', autor);
            if (estudio) query.set('estudio', estudio);
            if (plataforma) query.set('plataforma', plataforma);
            if (modoJogo) query.set('modo_jogo', modoJogo);
            if (desenvolvedor) query.set('desenvolvedor', desenvolvedor);

            const [midiasData, generosData] = await Promise.all([
                apiCall(`/midias?${query.toString()}`).catch(() => ({ midias: [] })),
                apiCall(`/generos?tipo=${tipo}`).catch(() => ({ generos: [] })),
            ]);

            setMidias(midiasData.midias || []);
            setGeneros(generosData.generos || []);
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        } finally {
            setLoading(false);
        }
    }, [apiCall, tipo, ordem, busca, genero, status, demografia, autor, estudio, plataforma, modoJogo, desenvolvedor]);

    useEffect(() => {
        const timer = setTimeout(() => carregarDados(), 300);
        return () => clearTimeout(timer);
    }, [carregarDados]);

    const tabClass = (candidateTipo) =>
        `px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            tipo === candidateTipo
                ? 'border-accent-blue text-accent-blue'
                : 'border-transparent text-text-secondary hover:text-text-bright hover:border-dark-border'
        }`;

    const inputClass = 'px-3 py-2.5 bg-dark-secondary border border-dark-border rounded text-sm text-text-primary focus:outline-none focus:border-accent-blue transition-colors';
    const TIPO_LABELS = { anime: 'Anime', manga: 'Mangá', jogo: 'Jogos' };

    const renderTypeSpecificFilters = () => {
        if (tipo === 'anime') {
            return (
                <>
                    <select value={status} onChange={(e) => updateParam('status', e.target.value)} className={inputClass}>
                        {ANIME_STATUS_OPTIONS.map(option => (
                            <option key={option.value || 'status'} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                    <input
                        type="text"
                        value={estudio}
                        onChange={(e) => updateParam('estudio', e.target.value)}
                        placeholder="Estúdio"
                        className={inputClass}
                    />
                </>
            );
        }

        if (tipo === 'manga') {
            return (
                <>
                    <select value={status} onChange={(e) => updateParam('status', e.target.value)} className={inputClass}>
                        {MANGA_STATUS_OPTIONS.map(option => (
                            <option key={option.value || 'status'} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                    <select value={demografia} onChange={(e) => updateParam('demografia', e.target.value)} className={inputClass}>
                        {MANGA_DEMOGRAFIA_OPTIONS.map(option => (
                            <option key={option.value || 'demografia'} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                    <input
                        type="text"
                        value={autor}
                        onChange={(e) => updateParam('autor', e.target.value)}
                        placeholder="Autor"
                        className={inputClass}
                    />
                </>
            );
        }

        return (
            <>
                <select value={status} onChange={(e) => updateParam('status', e.target.value)} className={inputClass}>
                    {JOGO_STATUS_OPTIONS.map(option => (
                        <option key={option.value || 'status'} value={option.value}>{option.label}</option>
                    ))}
                </select>
                <input
                    type="text"
                    value={plataforma}
                    onChange={(e) => updateParam('plataforma', e.target.value)}
                    placeholder="Plataforma"
                    className={inputClass}
                />
                <select value={modoJogo} onChange={(e) => updateParam('modo_jogo', e.target.value)} className={inputClass}>
                    {JOGO_MODO_OPTIONS.map(option => (
                        <option key={option.value || 'modo'} value={option.value}>{option.label}</option>
                    ))}
                </select>
                <input
                    type="text"
                    value={desenvolvedor}
                    onChange={(e) => updateParam('desenvolvedor', e.target.value)}
                    placeholder="Desenvolvedor"
                    className={inputClass}
                />
            </>
        );
    };

    return (
        <div className="space-y-5">
            {tiposDisponiveis.length > 1 && (
                <div className="border-b border-dark-border">
                    <div className="flex">
                        {tiposDisponiveis.map(candidateTipo => (
                            <button key={candidateTipo} onClick={() => setTipo(candidateTipo)} className={tabClass(candidateTipo)}>
                                {TIPO_LABELS[candidateTipo] || candidateTipo}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
                <div className="col-span-2 md:col-span-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
                    <input
                        type="text"
                        placeholder="Search..."
                        value={busca}
                        onChange={(e) => updateParam('q', e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 bg-dark-secondary border border-dark-border rounded text-sm text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent-blue transition-colors"
                    />
                </div>

                <select value={genero} onChange={(e) => updateParam('genero', e.target.value)} className={inputClass}>
                    <option value="">Gêneros</option>
                    {generos.map(generoItem => (
                        <option key={generoItem.id_genero || generoItem.nome} value={generoItem.nome}>{generoItem.nome}</option>
                    ))}
                </select>

                <select value={ordem} onChange={(e) => updateParam('ordem', e.target.value)} className={inputClass}>
                    {ORDEM_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>

                {renderTypeSpecificFilters()}
            </div>

            {!loading && (
                <p className="text-xs text-text-secondary">{midias.length} resultado(s)</p>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-accent-blue border-t-transparent"></div>
                </div>
            ) : midias.length === 0 ? (
                <div className="text-center py-20">
                    <p className="text-text-secondary">
                        {busca ? 'Nenhuma mídia encontrada com essa busca' : 'Nenhuma mídia disponível'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
                    {midias.map(midia => (
                        <MediaCard
                            key={midia.id_midia}
                            midia={midia}
                            onClick={() => navigate(`/media/${midia.id_midia}`)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default BrowsePage;
