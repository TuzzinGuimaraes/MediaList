// Total do Progresso de um Item de lista, como o app calcula (Mobile/src/dominio/itemLista.ts):
// a cópia gravada no Item (`progresso_total`) ou, sem ela, o total da Mídia pelo Tipo.
// Jogo não tem Progresso.
export function totalDoItem(item) {
    if (item.tipo !== 'anime' && item.tipo !== 'manga') return null;
    if (item.progresso_total != null) return item.progresso_total;
    const daMidia = item.tipo === 'anime' ? item.numero_episodios : item.numero_capitulos;
    return daMidia ?? null;
}
