import React, { useCallback, useEffect, useState } from 'react';
import { FileText, Plus } from 'lucide-react';
import { useApi } from '../contexts/ApiContext';
import { useAuth } from '../contexts/AuthContext';
import CreateNoticiaModal from '../components/CreateNoticiaModal';

const NewsPage = () => {
    const { apiCall } = useApi();
    const { user, permissions } = useAuth();
    const [noticias, setNoticias] = useState([]);
    const [loading, setLoading] = useState(true);
    const [createModalOpen, setCreateModalOpen] = useState(false);

    const carregarNoticias = useCallback(async () => {
        setLoading(true);
        try {
            const data = await apiCall('/noticias?limite=20');
            setNoticias(data.noticias || []);
        } catch (error) {
            console.error('Erro ao carregar notícias:', error);
        } finally {
            setLoading(false);
        }
    }, [apiCall]);

    useEffect(() => {
        carregarNoticias();
    }, [carregarNoticias]);

    const criarNoticia = async (dados) => {
        try {
            await apiCall('/noticias', {
                method: 'POST',
                body: JSON.stringify(dados)
            });
            await carregarNoticias();
            setCreateModalOpen(false);
        } catch (error) {
            throw new Error(error.message || 'Erro ao criar notícia');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-accent-blue border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-text-bright flex items-center gap-2">
                    <FileText size={20} className="text-accent-blue" />
                    Notícias
                </h2>
                {(permissions?.pode_moderar || permissions?.nivel_acesso === 'admin') && (
                    <button
                        onClick={() => setCreateModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-accent-blue hover:bg-accent-blue-hover text-white text-sm font-semibold rounded transition-colors"
                    >
                        <Plus size={16} />
                        Criar Notícia
                    </button>
                )}
            </div>

            {noticias.length === 0 ? (
                <div className="text-center py-20">
                    <p className="text-text-secondary text-sm">Nenhuma notícia disponível no momento.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {noticias.map((noticia, index) => (
                        <article key={index} className="bg-dark-secondary rounded-md overflow-hidden">
                            {noticia.imagem_url && (
                                <img
                                    src={noticia.imagem_url}
                                    alt={noticia.titulo}
                                    className="w-full h-48 object-cover"
                                />
                            )}
                            <div className="p-5">
                                <h3 className="text-lg font-bold text-text-bright mb-2">{noticia.titulo}</h3>
                                <p className="text-xs text-text-secondary mb-3">
                                    Por {noticia.autor} &middot; {new Date(noticia.data_publicacao).toLocaleDateString('pt-BR')}
                                </p>
                                <p className="text-sm text-text-primary leading-relaxed">{noticia.conteudo}</p>
                                {noticia.tags && noticia.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-3">
                                        {noticia.tags.map((tag, i) => (
                                            <span key={i} className="bg-accent-blue/15 text-accent-blue text-xs px-2 py-0.5 rounded">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            )}

            <CreateNoticiaModal
                isOpen={createModalOpen}
                onClose={() => setCreateModalOpen(false)}
                onSave={criarNoticia}
                userName={user?.nome}
            />
        </div>
    );
};

export default NewsPage;
