import React, { createContext, useCallback, useContext } from 'react';

const ApiContext = createContext(null);

const API_URL = process.env.REACT_APP_API_URL
    || (process.env.NODE_ENV === 'development' ? 'http://localhost:5000/api' : '/api');

export const ApiProvider = ({ children, onUnauthorized }) => {
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
                if (onUnauthorized) onUnauthorized();
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
    }, [onUnauthorized]);

    return (
        <ApiContext.Provider value={{ apiCall, API_URL }}>
            {children}
        </ApiContext.Provider>
    );
};

export const useApi = () => {
    const context = useContext(ApiContext);
    if (!context) {
        throw new Error('useApi must be used within an ApiProvider');
    }
    return context;
};

export default ApiContext;
