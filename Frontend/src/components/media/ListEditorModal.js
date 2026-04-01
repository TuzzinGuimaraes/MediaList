import React, { useEffect, useState } from 'react';
import { Heart, X } from 'lucide-react';
import { useApi } from '../../contexts/ApiContext';

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

const DEFAULT_STATUS = {
    anime: 'planejado',
    manga: 'planejado',
    jogo: 'na_fila',
};

const labelProgresso = (tipo) => {
    switch (tipo) {
        case 'anime': return 'Episode Progress';
        case 'manga': return 'Chapter Progress';
        case 'jogo': return 'Hours Played';
        default: return 'Progress';
    }
};

const labelRewatches = (tipo) => {
    switch (tipo) {
        case 'anime': return 'Total Rewatches';
        case 'manga': return 'Total Rereads';
        case 'jogo': return 'Total Replays';
        default: return 'Replays';
    }
};

const ListEditorModal = ({ isOpen, onClose, midia, listaItem, onSave }) => {
    const { apiCall } = useApi();
    const [form, setForm] = useState({
        status_consumo: '',
        nota_usuario: '',
        progresso_atual: 0,
        favorito: false,
        data_inicio: '',
        data_conclusao: '',
        total_rewatches: 0,
        comentario: '',
        privado: false,
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen && midia) {
            if (listaItem) {
                setForm({
                    status_consumo: listaItem.status_consumo || DEFAULT_STATUS[midia.tipo] || 'planejado',
                    nota_usuario: listaItem.nota_usuario || '',
                    progresso_atual: listaItem.progresso_atual || 0,
                    favorito: Boolean(listaItem.favorito),
                    data_inicio: listaItem.data_inicio ? listaItem.data_inicio.substring(0, 10) : '',
                    data_conclusao: listaItem.data_conclusao ? listaItem.data_conclusao.substring(0, 10) : '',
                    total_rewatches: listaItem.total_rewatches || 0,
                    comentario: listaItem.comentario || '',
                    privado: Boolean(listaItem.privado),
                });
            } else {
                setForm({
                    status_consumo: DEFAULT_STATUS[midia.tipo] || 'planejado',
                    nota_usuario: '',
                    progresso_atual: 0,
                    favorito: false,
                    data_inicio: '',
                    data_conclusao: '',
                    total_rewatches: 0,
                    comentario: '',
                    privado: false,
                });
            }
        }
    }, [isOpen, midia, listaItem]);

    if (!isOpen || !midia) return null;

    const statusOptions = STATUS_POR_TIPO[midia.tipo] || [];
    const title = midia.titulo_portugues || midia.titulo_original;
    const progressoTotal = midia.numero_episodios || midia.numero_capitulos || null;

    const handleSave = async () => {
        setSaving(true);
        try {
            if (listaItem) {
                await apiCall(`/lista/${listaItem.id_lista}`, {
                    method: 'PUT',
                    body: JSON.stringify({
                        status_consumo: form.status_consumo,
                        nota_usuario: form.nota_usuario === '' ? null : Number(form.nota_usuario),
                        progresso_atual: Number(form.progresso_atual),
                        favorito: form.favorito,
                        data_inicio: form.data_inicio || null,
                        data_conclusao: form.data_conclusao || null,
                        total_rewatches: Number(form.total_rewatches),
                        comentario: form.comentario || null,
                        privado: form.privado,
                    }),
                });
            } else {
                await apiCall('/lista/adicionar', {
                    method: 'POST',
                    body: JSON.stringify({
                        id_midia: midia.id_midia,
                        status: form.status_consumo,
                        nota_usuario: form.nota_usuario === '' ? null : Number(form.nota_usuario),
                        progresso_atual: Number(form.progresso_atual),
                        favorito: form.favorito,
                        data_inicio: form.data_inicio || null,
                        data_conclusao: form.data_conclusao || null,
                        total_rewatches: Number(form.total_rewatches),
                        comentario: form.comentario || null,
                        privado: form.privado,
                    }),
                });
            }
            if (onSave) onSave();
        } catch (error) {
            alert(`Erro: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!listaItem || !window.confirm('Remover da lista?')) return;
        setSaving(true);
        try {
            await apiCall(`/lista/${listaItem.id_lista}`, { method: 'DELETE' });
            if (onSave) onSave();
        } catch (error) {
            alert(`Erro: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div className="bg-dark-tertiary rounded-lg w-full max-w-lg border border-dark-border shadow-2xl" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center gap-3 p-4 border-b border-dark-border">
                    <img
                        src={midia.poster_url || 'https://via.placeholder.com/60x90'}
                        alt=""
                        className="w-12 h-[72px] object-cover rounded"
                    />
                    <h3 className="flex-1 text-sm font-semibold text-text-bright line-clamp-2">{title}</h3>
                    <button
                        onClick={() => setForm({ ...form, favorito: !form.favorito })}
                        className={`p-1.5 rounded transition-colors ${form.favorito ? 'text-accent-red' : 'text-text-secondary hover:text-accent-red'}`}
                    >
                        <Heart size={20} fill={form.favorito ? 'currentColor' : 'none'} />
                    </button>
                    <button onClick={onClose} className="text-text-secondary hover:text-text-bright transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <div className="p-4 space-y-4">
                    {/* Row 1: Status + Score + Progress */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs text-text-secondary mb-1.5">Status</label>
                            <select
                                value={form.status_consumo}
                                onChange={(e) => setForm({ ...form, status_consumo: e.target.value })}
                                className="w-full px-2 py-2 bg-dark-primary border border-dark-border rounded text-sm text-text-primary focus:outline-none focus:border-accent-blue"
                            >
                                {statusOptions.map(s => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs text-text-secondary mb-1.5">Score</label>
                            <input
                                type="number"
                                min="0"
                                max="10"
                                step="0.5"
                                value={form.nota_usuario}
                                onChange={(e) => setForm({ ...form, nota_usuario: e.target.value })}
                                placeholder="0"
                                className="w-full px-2 py-2 bg-dark-primary border border-dark-border rounded text-sm text-text-primary focus:outline-none focus:border-accent-blue"
                            />
                        </div>

                        <div>
                            <label className="block text-xs text-text-secondary mb-1.5">{labelProgresso(midia.tipo)}</label>
                            <div className="flex items-center gap-1">
                                <input
                                    type="number"
                                    min="0"
                                    max={progressoTotal || undefined}
                                    value={form.progresso_atual}
                                    onChange={(e) => setForm({ ...form, progresso_atual: e.target.value })}
                                    className="w-full px-2 py-2 bg-dark-primary border border-dark-border rounded text-sm text-text-primary focus:outline-none focus:border-accent-blue"
                                />
                                {progressoTotal && (
                                    <span className="text-xs text-text-secondary whitespace-nowrap">/{progressoTotal}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Row 2: Start Date + Finish Date + Rewatches */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs text-text-secondary mb-1.5">Start Date</label>
                            <input
                                type="date"
                                value={form.data_inicio}
                                onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
                                className="w-full px-2 py-2 bg-dark-primary border border-dark-border rounded text-sm text-text-primary focus:outline-none focus:border-accent-blue"
                            />
                        </div>

                        <div>
                            <label className="block text-xs text-text-secondary mb-1.5">Finish Date</label>
                            <input
                                type="date"
                                value={form.data_conclusao}
                                onChange={(e) => setForm({ ...form, data_conclusao: e.target.value })}
                                className="w-full px-2 py-2 bg-dark-primary border border-dark-border rounded text-sm text-text-primary focus:outline-none focus:border-accent-blue"
                            />
                        </div>

                        <div>
                            <label className="block text-xs text-text-secondary mb-1.5">{labelRewatches(midia.tipo)}</label>
                            <input
                                type="number"
                                min="0"
                                value={form.total_rewatches}
                                onChange={(e) => setForm({ ...form, total_rewatches: e.target.value })}
                                className="w-full px-2 py-2 bg-dark-primary border border-dark-border rounded text-sm text-text-primary focus:outline-none focus:border-accent-blue"
                            />
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-xs text-text-secondary mb-1.5">Notes</label>
                        <textarea
                            value={form.comentario}
                            onChange={(e) => setForm({ ...form, comentario: e.target.value })}
                            rows={3}
                            placeholder="Anotações pessoais..."
                            className="w-full px-3 py-2 bg-dark-primary border border-dark-border rounded text-sm text-text-primary focus:outline-none focus:border-accent-blue resize-none"
                        />
                    </div>

                    {/* Private toggle */}
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={form.privado}
                            onChange={(e) => setForm({ ...form, privado: e.target.checked })}
                            className="w-4 h-4 rounded border-dark-border text-accent-blue focus:ring-accent-blue"
                        />
                        <span className="text-xs text-text-secondary">Private</span>
                    </label>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-4 border-t border-dark-border">
                    {listaItem ? (
                        <button
                            onClick={handleDelete}
                            className="text-sm text-accent-red hover:text-red-400 transition-colors"
                            disabled={saving}
                        >
                            Delete
                        </button>
                    ) : (
                        <div />
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2 bg-accent-blue hover:bg-accent-blue-hover text-white text-sm font-semibold rounded transition-colors disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ListEditorModal;
