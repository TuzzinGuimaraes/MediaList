// Envelope de paginação da API: { itens, pagina, por_pagina, total } (teto de 50 por página).
export const POR_PAGINA_MAXIMO = 50;

const comPagina = (endpoint, pagina, porPagina) => {
    const separador = endpoint.includes('?') ? '&' : '?';
    return `${endpoint}${separador}pagina=${pagina}&por_pagina=${porPagina}`;
};

// Pede página por página até juntar o `total`. Para telas que precisam do conjunto inteiro
// (distribuição de notas, usuários da moderação).
export const buscarTodasAsPaginas = async (apiCall, endpoint) => {
    const itens = [];
    let total = 0;
    for (let pagina = 1; ; pagina += 1) {
        const data = await apiCall(comPagina(endpoint, pagina, POR_PAGINA_MAXIMO));
        const recebidos = data.itens || [];
        itens.push(...recebidos);
        total = data.total ?? itens.length;
        if (recebidos.length === 0 || itens.length >= total) break;
    }
    return { itens, total };
};
