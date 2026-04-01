import React, { useState } from 'react';
import { X, Save, Plus } from 'lucide-react';

const CreateNoticiaModal = ({ isOpen, onClose, onSave, userName }) => {
    const [formData, setFormData] = useState({
        titulo: '', conteudo: '', categoria: 'geral', tags: '', imagem_url: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const tagsArray = formData.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
            await onSave({ ...formData, autor: userName || 'Admin', tags: tagsArray });
            setFormData({ titulo: '', conteudo: '', categoria: 'geral', tags: '', imagem_url: '' });
            onClose();
        } catch (err) {
            setError(err.message || 'Erro ao criar notícia');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
            setFormData({ titulo: '', conteudo: '', categoria: 'geral', tags: '', imagem_url: '' });
            setError('');
            onClose();
        }
    };

    if (!isOpen) return null;

    const inputClass = "w-full px-4 py-3 bg-dark-primary border border-dark-border rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent-blue transition-colors";
    const labelClass = "block text-xs text-text-secondary uppercase tracking-wider mb-1.5";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={handleClose}>
            <div className="bg-dark-tertiary rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-dark-border" onClick={e => e.stopPropagation()}>
                <div className="sticky top-0 bg-dark-tertiary border-b border-dark-border p-4 flex items-center justify-between z-10">
                    <div className="flex items-center gap-2 text-text-bright">
                        <Plus size={20} />
                        <h2 className="text-lg font-bold">Criar Nova Notícia</h2>
                    </div>
                    <button onClick={handleClose} className="text-text-secondary hover:text-text-bright transition-colors" disabled={loading}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {error && (
                        <div className="bg-accent-red/10 border border-accent-red/30 text-accent-red text-sm rounded-lg p-3">{error}</div>
                    )}

                    <div>
                        <label className={labelClass}>Título da Notícia *</label>
                        <input type="text" value={formData.titulo} onChange={(e) => handleChange('titulo', e.target.value)}
                            className={inputClass} placeholder="Digite o título" required disabled={loading} />
                    </div>

                    <div>
                        <label className={labelClass}>Conteúdo</label>
                        <textarea value={formData.conteudo} onChange={(e) => handleChange('conteudo', e.target.value)}
                            className={`${inputClass} resize-none`} placeholder="Digite o conteúdo" rows="6" disabled={loading} />
                    </div>

                    <div className="bg-dark-secondary border border-dark-border rounded-lg p-3">
                        <span className="text-xs text-text-secondary">Autor: </span>
                        <span className="text-xs text-accent-blue font-medium">{userName || 'Admin'}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Categoria</label>
                            <select value={formData.categoria} onChange={(e) => handleChange('categoria', e.target.value)}
                                className={inputClass} disabled={loading}>
                                <option value="geral">Geral</option>
                                <option value="lancamento">Lançamento</option>
                                <option value="temporada">Nova Temporada</option>
                                <option value="evento">Evento</option>
                                <option value="manga">Mangá</option>
                                <option value="filme">Filme</option>
                                <option value="anuncio">Anúncio</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Tags (vírgula)</label>
                            <input type="text" value={formData.tags} onChange={(e) => handleChange('tags', e.target.value)}
                                className={inputClass} placeholder="anime, ação" disabled={loading} />
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>URL da Imagem</label>
                        <input type="url" value={formData.imagem_url} onChange={(e) => handleChange('imagem_url', e.target.value)}
                            className={inputClass} placeholder="https://..." disabled={loading} />
                        {formData.imagem_url && (
                            <img src={formData.imagem_url} alt="Preview" className="mt-2 w-full h-40 object-cover rounded-lg"
                                onError={(e) => { e.target.style.display = 'none'; }} />
                        )}
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={handleClose} disabled={loading}
                            className="flex-1 px-4 py-2.5 border border-dark-border text-text-secondary rounded-lg font-medium hover:bg-dark-secondary transition-colors">
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading}
                            className="flex-1 px-4 py-2.5 bg-accent-blue hover:bg-accent-blue-hover text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                            {loading ? <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div> Criando...</>
                                : <><Save size={16} /> Publicar</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateNoticiaModal;
