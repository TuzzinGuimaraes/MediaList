import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Shield, Star, Trash2, Users } from 'lucide-react';
import { useApi } from '../contexts/ApiContext';
import { useAuth } from '../contexts/AuthContext';

const AdminPage = () => {
    const { apiCall } = useApi();
    const { permissions } = useAuth();
    const [activeTab, setActiveTab] = useState('usuarios');
    const [usuarios, setUsuarios] = useState([]);
    const [avaliacoes, setAvaliacoes] = useState([]);
    const hasLoadedRef = useRef({ usuarios: false, avaliacoes: false });

    const carregarUsuarios = useCallback(async () => {
        try {
            const data = await apiCall('/moderacao/usuarios');
            setUsuarios(data.usuarios || []);
        } catch (error) {
            alert(`Erro: ${error.message}`);
        }
    }, [apiCall]);

    const carregarAvaliacoes = useCallback(async () => {
        try {
            const data = await apiCall('/moderacao/avaliacoes');
            setAvaliacoes(data.avaliacoes || []);
        } catch (error) {
            alert(`Erro: ${error.message}`);
        }
    }, [apiCall]);

    useEffect(() => {
        if (activeTab === 'usuarios' && !hasLoadedRef.current.usuarios) {
            hasLoadedRef.current.usuarios = true;
            carregarUsuarios();
        } else if (activeTab === 'avaliacoes' && !hasLoadedRef.current.avaliacoes) {
            hasLoadedRef.current.avaliacoes = true;
            carregarAvaliacoes();
        }
    }, [activeTab, carregarUsuarios, carregarAvaliacoes]);

    const alterarStatusUsuario = async (userId, ativar) => {
        try {
            const endpoint = ativar ? 'ativar' : 'desativar';
            await apiCall(`/moderacao/usuarios/${userId}/${endpoint}`, { method: 'PUT' });
            await carregarUsuarios();
        } catch (error) {
            alert(`Erro: ${error.message}`);
        }
    };

    const deletarAvaliacao = async (avaliacaoId) => {
        if (!window.confirm('Deseja deletar esta avaliação?')) return;
        try {
            await apiCall(`/avaliacoes/${avaliacaoId}`, { method: 'DELETE' });
            await carregarAvaliacoes();
        } catch (error) {
            alert(`Erro: ${error.message}`);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-lg font-bold text-text-bright flex items-center gap-2">
                <Shield size={20} className="text-accent-blue" />
                {permissions?.nivel_acesso === 'admin' ? 'Administração' : 'Moderação'}
            </h2>

            <div className="flex gap-2">
                <button
                    onClick={() => setActiveTab('usuarios')}
                    className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors ${
                        activeTab === 'usuarios' ? 'bg-accent-blue text-white' : 'bg-dark-secondary text-text-secondary hover:text-text-primary'
                    }`}
                >
                    <Users size={16} /> Usuários
                </button>
                <button
                    onClick={() => setActiveTab('avaliacoes')}
                    className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors ${
                        activeTab === 'avaliacoes' ? 'bg-accent-blue text-white' : 'bg-dark-secondary text-text-secondary hover:text-text-primary'
                    }`}
                >
                    <Star size={16} /> Avaliações
                </button>
            </div>

            {activeTab === 'usuarios' && (
                <div className="space-y-2">
                    {usuarios.map(usuario => (
                        <div key={usuario.id_usuario} className="bg-dark-secondary rounded-md p-4 flex items-center justify-between">
                            <div>
                                <h4 className="text-sm font-bold text-text-bright">{usuario.nome_completo}</h4>
                                <p className="text-xs text-text-secondary">{usuario.email}</p>
                                <p className="text-xs text-text-secondary mt-0.5">
                                    Grupos: {usuario.grupos || 'Nenhum'} | Mídias: {usuario.total_midias || 0} | Avaliações: {usuario.total_avaliacoes}
                                </p>
                            </div>
                            <button
                                onClick={() => alterarStatusUsuario(usuario.id_usuario, !usuario.ativo)}
                                className={`px-4 py-1.5 rounded text-xs font-semibold transition-colors ${
                                    usuario.ativo
                                        ? 'bg-accent-red/20 text-accent-red hover:bg-accent-red/30'
                                        : 'bg-accent-green/20 text-accent-green hover:bg-accent-green/30'
                                }`}
                            >
                                {usuario.ativo ? 'Desativar' : 'Ativar'}
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'avaliacoes' && (
                <div className="space-y-2">
                    {avaliacoes.map(avaliacao => (
                        <div key={avaliacao.id_avaliacao} className="bg-dark-secondary rounded-md p-4">
                            <div className="flex items-start justify-between mb-2">
                                <div>
                                    <h4 className="text-sm font-bold text-text-bright">{avaliacao.titulo_avaliacao || 'Sem título'}</h4>
                                    <p className="text-xs text-text-secondary">
                                        Por: {avaliacao.nome_completo} | {avaliacao.tipo} | {avaliacao.titulo_portugues || avaliacao.titulo_original} | Nota: {avaliacao.nota}
                                    </p>
                                </div>
                                <button
                                    onClick={() => deletarAvaliacao(avaliacao.id_avaliacao)}
                                    className="text-accent-red hover:text-red-400 transition-colors"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                            {avaliacao.texto_avaliacao && (
                                <p className="text-sm text-text-primary">{avaliacao.texto_avaliacao}</p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AdminPage;
