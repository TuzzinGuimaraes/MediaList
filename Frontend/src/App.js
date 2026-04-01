import React, { useCallback, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import { ApiProvider } from './contexts/ApiContext';
import { AuthProvider } from './contexts/AuthContext';
import { SessionProvider } from './contexts/SessionContext';
import MainLayout from './layouts/MainLayout';
import AuthLayout from './layouts/AuthLayout';

import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import BrowsePage from './pages/BrowsePage';
import MediaDetailPage from './pages/MediaDetailPage';
import { AnimeListPage, MangaListPage, GameListPage } from './pages/MediaListPage';
import StatsPage from './pages/StatsPage';
import NewsPage from './pages/NewsPage';
import AdminPage from './pages/AdminPage';
import ProfilePage from './pages/ProfilePage';

function AppContent() {
    const [, forceUpdate] = useState(0);

    const handleUnauthorized = useCallback(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('permissions');
        forceUpdate(n => n + 1);
    }, []);

    return (
        <ApiProvider onUnauthorized={handleUnauthorized}>
            <SessionProvider>
            <AuthProvider>
                <Routes>
                    {/* Auth routes */}
                    <Route element={<AuthLayout />}>
                        <Route path="/login" element={<LoginPage />} />
                    </Route>

                    {/* Authenticated routes */}
                    <Route element={<MainLayout />}>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/browse" element={<BrowsePage />} />
                        <Route path="/media/:id" element={<MediaDetailPage />} />
                        <Route path="/anime-list" element={<AnimeListPage />} />
                        <Route path="/manga-list" element={<MangaListPage />} />
                        <Route path="/game-list" element={<GameListPage />} />
                        <Route path="/stats" element={<StatsPage />} />
                        <Route path="/news" element={<NewsPage />} />
                        <Route path="/admin" element={<AdminPage />} />
                        <Route path="/profile" element={<ProfilePage />} />
                    </Route>

                    {/* Fallback */}
                    <Route path="*" element={
                        <div className="min-h-screen bg-dark-primary flex items-center justify-center">
                            <div className="text-center">
                                <h1 className="text-4xl font-bold text-text-bright mb-2">404</h1>
                                <p className="text-text-secondary">Página não encontrada</p>
                            </div>
                        </div>
                    } />
                </Routes>
            </AuthProvider>
            </SessionProvider>
        </ApiProvider>
    );
}

function App() {
    return (
        <BrowserRouter>
            <AppContent />
        </BrowserRouter>
    );
}

export default App;
