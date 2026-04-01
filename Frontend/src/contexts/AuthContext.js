import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useApi } from './ApiContext';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [permissions, setPermissions] = useState(null);
    const [loading, setLoading] = useState(true);
    const { apiCall } = useApi();

    const logout = useCallback(async () => {
        const token = localStorage.getItem('token');

        if (token) {
            try {
                await fetch(
                    `${process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'development' ? 'http://localhost:5000/api' : '/api')}/auth/logout`,
                    {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
            } catch (error) {
                console.error('Erro ao revogar token:', error);
            }
        }

        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('permissions');
        setUser(null);
        setPermissions(null);
    }, []);

    const login = useCallback(async (email, senha) => {
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
    }, [apiCall]);

    const register = useCallback(async (formData) => {
        try {
            await apiCall('/auth/registro', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            return await login(formData.email, formData.senha);
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, [apiCall, login]);

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
                    await logout();
                }
                setLoading(false);
            };
            validateToken();
        } else {
            setLoading(false);
        }
    }, [apiCall, logout]);

    return (
        <AuthContext.Provider value={{ user, permissions, loading, login, logout, register }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export default AuthContext;
