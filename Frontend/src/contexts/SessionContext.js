import React, { createContext, useCallback, useContext, useState } from 'react';

const SessionContext = createContext(null);

export const SESSIONS = {
    animanga: {
        id: 'animanga',
        label: 'Animes/Mangás',
        tipos: ['anime', 'manga'],
    },
    jogos: {
        id: 'jogos',
        label: 'Jogos',
        tipos: ['jogo'],
    },
};

export const SessionProvider = ({ children }) => {
    const [sessao, setSessaoState] = useState(
        () => localStorage.getItem('medialist_sessao') || 'animanga'
    );

    const setSessao = useCallback((novaSessao) => {
        if (SESSIONS[novaSessao]) {
            localStorage.setItem('medialist_sessao', novaSessao);
            setSessaoState(novaSessao);
        }
    }, []);

    const sessaoConfig = SESSIONS[sessao];

    return (
        <SessionContext.Provider value={{ sessao, setSessao, sessaoConfig, SESSIONS }}>
            {children}
        </SessionContext.Provider>
    );
};

export const useSession = () => {
    const ctx = useContext(SessionContext);
    if (!ctx) throw new Error('useSession deve ser usado dentro de SessionProvider');
    return ctx;
};

export default SessionContext;
