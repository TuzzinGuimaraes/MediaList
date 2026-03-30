import React, { useCallback, useEffect, useState } from 'react';
import { Star, TrendingUp } from 'lucide-react';

import AdminTab from './components/AdminTab';
import AnimeCard from './components/AnimeCard';
import AnimeDetalhesModal from './components/AnimeDetalhesModal';
import AvaliacaoModal from './components/AvaliacaoModal';
import CreateNoticiaModal from './components/CreateNoticiaModal';
import CriarAtualizacaoModal from './components/CriarAtualizacaoModal';
import EditAnimeModal from './components/EditAnimeModal';
import EstatisticasTab from './components/EstatisticasTab';
import Header from './components/Header';
import LoadingSpinner from './components/LoadingSpinner';
import LoginForm from './components/LoginForm';
import MinhaListaTab from './components/MinhaListaTab';
import NoticiasTab from './components/NoticiasTab';
import SearchBar from './components/SearchBar';

const API_URL = process.env.REACT_APP_API_URL
    || (process.env.NODE_ENV === 'development' ? 'http://localhost:5000/api' : '/api');

const MEDIA_CONFIG = {
    anime: {
        label: 'Animes',
        singular: 'anime',
        searchPlaceholder: 'Buscar animes por título ou sinopse...',
        defaultStatus: 'planejado'
    },
    manga: {
        label: 'Mangás',
        singular: 'mangá',
        searchPlaceholder: 'Buscar mangás por título, autor ou demografia...',
        defaultStatus: 'planejado'
    },
    jogo: {
        label: 'Jogos',
        singular: 'jogo',
        searchPlaceholder: 'Buscar jogos por título ou plataforma...',
        defaultStatus: 'na_fila'
    },
    musica: {
        label: 'Músicas',
        singular: 'música',
        searchPlaceholder: 'Buscar álbuns, singles ou artistas...',
        defaultStatus: 'planejado'
    }
};

function App() {
    const [user, setUser] = useState(null);
    const [permissions, setPermissions] = useState(null);
    const [activeTab, setActiveTab] = useState('home');
    const [activeMediaType, setActiveMediaType] = useState('anime');
    const [midias, setMidias] = useState([]);
    const [minhaLista, setMinhaLista] = useState([]);
    const [notificacoes, setNotificacoes] = useState([]);
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [estatisticas, setEstatisticas] = useState([]);
    const [estatisticasResumo, setEstatisticasResumo] = useState(null);
    const [noticias, setNoticias] = useState([]);

    const [usuarios, setUsuarios] = useState([]);
    const [avaliacoesModeracao, setAvaliacoesModeracao] = useState([]);

    const [editModalOpen, setEditModalOpen] = useState(false);
    const [midiaToEdit, setMidiaToEdit] = useState(null);

    const [createNoticiaModalOpen, setCreateNoticiaModalOpen] = useState(false);

    const [avaliacaoModalOpen, setAvaliacaoModalOpen] = useState(false);
    const [midiaToAvaliar, setMidiaToAvaliar] = useState(null);

    const [detalhesModalOpen, setDetalhesModalOpen] = useState(false);
    const [midiaDetalhes, setMidiaDetalhes] = useState(null);

    const [atualizacaoModalOpen, setAtualizacaoModalOpen] = useState(false);
    const [midiaParaAtualizar, setMidiaParaAtualizar] = useState(null);

    const handleLogout = useCallback(async () => {
        const token = localStorage.getItem('token');

        if (token) {
            try {
                await fetch(`${API_URL}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
            } catch (error) {
                console.error('Erro ao revogar token:', error);
            }
        }

        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('permissions');
        setUser(null);
        setPermissions(null);
        setMinhaLista([]);
        setMidias([]);
        setNotificacoes([]);
        setEstatisticas([]);
        setEstatisticasResumo(null);
        setNoticias([]);
        setActiveTab('home');
        setActiveMediaType('anime');
    }, []);

    const apiCall = useCallback(async (endpoint, options = {}) => {
        const token = localStorage.getItem('token');
        const headers = {
            'Content-Type': 'application/json',
            ...(token && { Authorization: `Bearer ${token}` })
        };

        try {
            const response = await fetch(`${API_URL}${endpoint}`, {
                ...options,
                headers: { ...headers, ...options.headers }
            });

            const contentType = response.headers.get('content-type');
            let data = {};

            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            }

            if (response.status === 401 || response.status === 422) {
                await handleLogout();
                throw new Error('Sessão expirada. Faça login novamente.');
            }

            if (!response.ok) {
                throw new Error(data.erro || data.msg || 'Erro na requisição');
            }

            return data;
        } catch (error) {
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Erro de conexão com o servidor.');
            }
            throw error;
        }
    }, [handleLogout]);

    const carregarDados = useCallback(async (tipo = activeMediaType, busca = searchTerm) => {
        if (!localStorage.getItem('token')) return;

        setLoading(true);
        try {
            const query = new URLSearchParams({
                tipo,
                por_pagina: '200',
                ordem: 'nota_media'
            });
            if (busca && busca.length >= 2) {
                query.set('busca', busca);
            }

            const resultados = await Promise.all([
                apiCall(`/midias?${query.toString()}`).catch(() => null),
                apiCall('/lista').catch(() => null),
                apiCall('/notificacoes?nao_lidas=true').catch(() => null),
                apiCall(`/generos?tipo=${tipo}`).catch(() => null),
                apiCall('/usuario/estatisticas').catch(() => null),
                apiCall('/noticias?limite=10').catch(() => null)
            ]);

            setMidias(resultados[0]?.midias || []);
            setMinhaLista(resultados[1]?.lista || []);
            setNotificacoes(resultados[2]?.notificacoes || []);
            setEstatisticas(resultados[4]?.estatisticas || []);
            setEstatisticasResumo(resultados[4]?.resumo || null);
            setNoticias(resultados[5]?.noticias || []);
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
        } finally {
            setLoading(false);
        }
    }, [apiCall, activeMediaType, searchTerm]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        const userData = localStorage.getItem('user');
        const userPermissions = localStorage.getItem('permissions');

        if (token && userData) {
            const validateToken = async () => {
                try {
                    await apiCall('/auth/me');
                    setUser(JSON.parse(userData));
                    if (userPermissions) {
                        setPermissions(JSON.parse(userPermissions));
                    }
                } catch (error) {
                    console.warn('Token inválido na inicialização');
                }
            };

            validateToken();
        }
    }, [apiCall]);

    useEffect(() => {
        if (!user) return;
        const timer = setTimeout(() => {
            carregarDados(activeMediaType, searchTerm);
        }, 350);
        return () => clearTimeout(timer);
    }, [user, activeMediaType, searchTerm, carregarDados]);

    const handleLogin = async (email, senha) => {
        try {
            const data = await apiCall('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, senha })
            });

            const mergedPermissions = {
                ...data.usuario.permissoes,
                nivel_acesso: data.usuario.nivel_acesso,
                grupos: data.usuario.grupos
            };

            localStorage.setItem('token', data.access_token);
            localStorage.setItem('user', JSON.stringify(data.usuario));
            localStorage.setItem('permissions', JSON.stringify(mergedPermissions));

            setUser(data.usuario);
            setPermissions(mergedPermissions);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const handleRegistro = async (formData) => {
        try {
            await apiCall('/auth/registro', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            return await handleLogin(formData.email, formData.senha);
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const adicionarMidiaLista = async (midiaId, tipo) => {
        try {
            const status = MEDIA_CONFIG[tipo]?.defaultStatus || 'planejado';
            await apiCall('/lista/adicionar', {
                method: 'POST',
                body: JSON.stringify({ id_midia: midiaId, status })
            });

            await carregarDados(activeMediaType, searchTerm);
            alert('Mídia adicionada à sua lista!');
        } catch (error) {
            alert(`Erro: ${error.message}`);
        }
    };

    const atualizarItemLista = async (listaId, dados) => {
        try {
            await apiCall(`/lista/${listaId}`, {
                method: 'PUT',
                body: JSON.stringify(dados)
            });
            await carregarDados(activeMediaType, searchTerm);
        } catch (error) {
            alert(`Erro ao atualizar: ${error.message}`);
        }
    };

    const removerItemLista = async (listaId) => {
        if (!window.confirm('Deseja remover esta mídia da sua lista?')) return;

        try {
            await apiCall(`/lista/${listaId}`, { method: 'DELETE' });
            await carregarDados(activeMediaType, searchTerm);
            alert('Mídia removida da lista!');
        } catch (error) {
            alert(`Erro ao remover: ${error.message}`);
        }
    };

    const marcarNotificacoesLidas = async () => {
        try {
            await apiCall('/notificacoes/marcar-todas-lidas', { method: 'PUT' });
            setNotificacoes([]);
        } catch (error) {
            console.error('Erro ao marcar notificações:', error);
        }
    };

    const carregarUsuarios = useCallback(async () => {
        try {
            const data = await apiCall('/moderacao/usuarios');
            setUsuarios(data.usuarios || []);
        } catch (error) {
            alert(`Erro ao carregar usuários: ${error.message}`);
        }
    }, [apiCall]);

    const alterarStatusUsuario = useCallback(async (userId, ativar) => {
        try {
            const endpoint = ativar ? 'ativar' : 'desativar';
            await apiCall(`/moderacao/usuarios/${userId}/${endpoint}`, { method: 'PUT' });
            await carregarUsuarios();
            alert(`Usuário ${ativar ? 'ativado' : 'desativado'} com sucesso!`);
        } catch (error) {
            alert(`Erro: ${error.message}`);
        }
    }, [apiCall, carregarUsuarios]);

    const carregarAvaliacoesModeracao = useCallback(async () => {
        try {
            const data = await apiCall('/moderacao/avaliacoes');
            setAvaliacoesModeracao(data.avaliacoes || []);
        } catch (error) {
            alert(`Erro ao carregar avaliações: ${error.message}`);
        }
    }, [apiCall]);

    const deletarAvaliacao = useCallback(async (avaliacaoId) => {
        if (!window.confirm('Deseja deletar esta avaliação?')) return;
        try {
            await apiCall(`/avaliacoes/${avaliacaoId}`, { method: 'DELETE' });
            await carregarAvaliacoesModeracao();
            alert('Avaliação deletada!');
        } catch (error) {
            alert(`Erro: ${error.message}`);
        }
    }, [apiCall, carregarAvaliacoesModeracao]);

    const abrirModalEdicao = (midia) => {
        setMidiaToEdit(midia);
        setEditModalOpen(true);
    };

    const fecharModalEdicao = () => {
        setEditModalOpen(false);
        setMidiaToEdit(null);
    };

    const salvarEdicaoMidia = async (midiaId, dados) => {
        try {
            await apiCall(`/midias/${midiaId}`, {
                method: 'PUT',
                body: JSON.stringify(dados)
            });
            await carregarDados(activeMediaType, searchTerm);
            alert('Mídia atualizada com sucesso!');
        } catch (error) {
            throw new Error(error.message || 'Erro ao atualizar mídia');
        }
    };

    const deletarMidia = async (midiaId) => {
        if (!window.confirm('Deseja deletar esta mídia?')) return;

        try {
            await apiCall(`/midias/${midiaId}`, { method: 'DELETE' });
            await carregarDados(activeMediaType, searchTerm);
            alert('Mídia deletada com sucesso!');
        } catch (error) {
            alert(`Erro: ${error.message}`);
        }
    };

    const abrirModalCriarNoticia = () => setCreateNoticiaModalOpen(true);
    const fecharModalCriarNoticia = () => setCreateNoticiaModalOpen(false);

    const criarNoticia = async (dados) => {
        try {
            await apiCall('/noticias', {
                method: 'POST',
                body: JSON.stringify(dados)
            });
            await carregarDados(activeMediaType, searchTerm);
            alert('Notícia criada com sucesso!');
        } catch (error) {
            throw new Error(error.message || 'Erro ao criar notícia');
        }
    };

    const abrirModalAvaliacao = (midia) => {
        setMidiaToAvaliar(midia);
        setAvaliacaoModalOpen(true);
    };

    const fecharModalAvaliacao = () => {
        setAvaliacaoModalOpen(false);
        setMidiaToAvaliar(null);
    };

    const criarAvaliacao = async (midiaId, dados) => {
        try {
            await apiCall('/avaliacoes', {
                method: 'POST',
                body: JSON.stringify({
                    id_midia: midiaId,
                    ...dados
                })
            });
            await carregarDados(activeMediaType, searchTerm);
            alert('Avaliação publicada com sucesso!');
        } catch (error) {
            throw new Error(error.message || 'Erro ao criar avaliação');
        }
    };

    const abrirDetalhesMidia = (midia) => {
        setMidiaDetalhes(midia);
        setDetalhesModalOpen(true);
    };

    const fecharDetalhesMidia = () => {
        setDetalhesModalOpen(false);
        setMidiaDetalhes(null);
    };

    const abrirModalAtualizacao = (midia) => {
        setMidiaParaAtualizar(midia);
        setAtualizacaoModalOpen(true);
        setDetalhesModalOpen(false);
    };

    const fecharModalAtualizacao = () => {
        setAtualizacaoModalOpen(false);
        setMidiaParaAtualizar(null);
    };

    const handleAtualizacaoSuccess = async () => {
        await carregarDados(activeMediaType, searchTerm);
    };

    if (!user) {
        return <LoginForm onLogin={handleLogin} onRegistro={handleRegistro} />;
    }

    const currentConfig = MEDIA_CONFIG[activeMediaType];
    const isInList = (midiaId) => minhaLista.some(item => item.id_midia === midiaId);
    const cardsDestaque = [...midias].sort((a, b) => (b?.nota_media || 0) - (a?.nota_media || 0)).slice(0, 8);
    const cardsRecentes = [...midias].sort((a, b) => new Date(b?.data_lancamento || 0) - new Date(a?.data_lancamento || 0)).slice(0, 8);

    return (
        <div className="min-h-screen bg-gray-50">
            <Header
                user={user}
                permissions={permissions}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                activeMediaType={activeMediaType}
                setActiveMediaType={setActiveMediaType}
                notificacoes={notificacoes}
                onLogout={handleLogout}
                onMarcarNotificacoesLidas={marcarNotificacoesLidas}
                showMobileMenu={showMobileMenu}
                setShowMobileMenu={setShowMobileMenu}
            />

            {(activeTab === 'home' || activeTab === 'catalogo' || activeTab === 'minha-lista') && (
                <SearchBar
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    placeholder={currentConfig.searchPlaceholder}
                />
            )}

            <main className="container mx-auto px-4 py-8">
                {loading && activeTab !== 'catalogo' ? (
                    <LoadingSpinner />
                ) : (
                    <>
                        {activeTab === 'home' && (
                            <div>
                                <div className="mb-8">
                                    <h2 className="text-3xl font-bold mb-2 flex items-center gap-2">
                                        <Star className="text-yellow-500" fill="currentColor" />
                                        Destaques em {currentConfig.label}
                                    </h2>
                                    <p className="text-gray-600">Os melhores {currentConfig.singular}s da comunidade</p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-12">
                                    {cardsDestaque.map(midia => (
                                        <AnimeCard
                                            key={midia.id_midia}
                                            anime={midia}
                                            showActions={permissions?.pode_moderar || permissions?.nivel_acesso === 'admin'}
                                            onAdd={adicionarMidiaLista}
                                            onEdit={abrirModalEdicao}
                                            onDelete={deletarMidia}
                                            onViewDetails={abrirDetalhesMidia}
                                            isInList={isInList(midia.id_midia)}
                                            permissions={permissions}
                                        />
                                    ))}
                                </div>

                                <div className="mb-8">
                                    <h2 className="text-3xl font-bold mb-2 flex items-center gap-2">
                                        <TrendingUp className="text-purple-600" />
                                        Lançamentos Recentes
                                    </h2>
                                    <p className="text-gray-600">Novos {currentConfig.singular}s no catálogo</p>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {cardsRecentes.map(midia => (
                                        <AnimeCard
                                            key={midia.id_midia}
                                            anime={midia}
                                            showActions={permissions?.pode_moderar || permissions?.nivel_acesso === 'admin'}
                                            onAdd={adicionarMidiaLista}
                                            onEdit={abrirModalEdicao}
                                            onDelete={deletarMidia}
                                            onViewDetails={abrirDetalhesMidia}
                                            isInList={isInList(midia.id_midia)}
                                            permissions={permissions}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'catalogo' && (
                            <div>
                                <div className="mb-6 flex justify-between items-center">
                                    <h2 className="text-3xl font-bold">Catálogo de {currentConfig.label}</h2>
                                    {!loading && (
                                        <span className="text-gray-600">{midias.length} resultado(s)</span>
                                    )}
                                </div>

                                {loading ? (
                                    <LoadingSpinner />
                                ) : midias.length === 0 ? (
                                    <div className="text-center py-12">
                                        <p className="text-gray-500 text-lg">
                                            {searchTerm ? 'Nenhuma mídia encontrada com essa busca' : 'Nenhuma mídia disponível'}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                        {midias.map(midia => (
                                            <AnimeCard
                                                key={midia.id_midia}
                                                anime={midia}
                                                showActions={permissions?.pode_moderar || permissions?.nivel_acesso === 'admin'}
                                                onAdd={adicionarMidiaLista}
                                                onEdit={abrirModalEdicao}
                                                onDelete={deletarMidia}
                                                onViewDetails={abrirDetalhesMidia}
                                                isInList={isInList(midia.id_midia)}
                                                permissions={permissions}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'minha-lista' && (
                            <div>
                                <h2 className="text-3xl font-bold mb-6">Minha Lista</h2>
                                <MinhaListaTab
                                    minhaLista={minhaLista}
                                    activeMediaType={activeMediaType}
                                    onChangeMediaType={setActiveMediaType}
                                    onUpdate={atualizarItemLista}
                                    onRemove={removerItemLista}
                                    onAvaliar={abrirModalAvaliacao}
                                    onViewDetails={abrirDetalhesMidia}
                                />
                            </div>
                        )}

                        {activeTab === 'estatisticas' && (
                            <EstatisticasTab estatisticas={estatisticas} resumo={estatisticasResumo} />
                        )}

                        {activeTab === 'noticias' && (
                            <NoticiasTab
                                noticias={noticias}
                                permissions={permissions}
                                onCreateNoticia={abrirModalCriarNoticia}
                            />
                        )}

                        {activeTab === 'admin' && (permissions?.pode_moderar || permissions?.nivel_acesso === 'admin') && (
                            <AdminTab
                                permissions={permissions}
                                usuarios={usuarios}
                                avaliacoesModeracao={avaliacoesModeracao}
                                onCarregarUsuarios={carregarUsuarios}
                                onAlterarStatusUsuario={alterarStatusUsuario}
                                onCarregarAvaliacoes={carregarAvaliacoesModeracao}
                                onDeletarAvaliacao={deletarAvaliacao}
                            />
                        )}
                    </>
                )}
            </main>

            <EditAnimeModal
                anime={midiaToEdit}
                isOpen={editModalOpen}
                onClose={fecharModalEdicao}
                onSave={salvarEdicaoMidia}
            />

            <CreateNoticiaModal
                isOpen={createNoticiaModalOpen}
                onClose={fecharModalCriarNoticia}
                onSave={criarNoticia}
                userName={user?.nome}
            />

            <AvaliacaoModal
                isOpen={avaliacaoModalOpen}
                onClose={fecharModalAvaliacao}
                onSave={criarAvaliacao}
                anime={midiaToAvaliar}
            />

            <AnimeDetalhesModal
                isOpen={detalhesModalOpen}
                onClose={fecharDetalhesMidia}
                anime={midiaDetalhes}
                onAvaliar={abrirModalAvaliacao}
                apiCall={apiCall}
                isInList={midiaDetalhes ? isInList(midiaDetalhes.id_midia) : false}
                permissions={permissions}
                onCriarAtualizacao={abrirModalAtualizacao}
            />

            <CriarAtualizacaoModal
                isOpen={atualizacaoModalOpen}
                onClose={fecharModalAtualizacao}
                anime={midiaParaAtualizar}
                apiCall={apiCall}
                onSuccess={handleAtualizacaoSuccess}
            />
        </div>
    );
}

export default App;
