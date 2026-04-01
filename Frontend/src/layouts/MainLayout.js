import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import Header from '../components/layout/Header';
import { useAuth } from '../contexts/AuthContext';

const MainLayout = () => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-dark-primary flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-accent-blue border-t-transparent"></div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="min-h-screen bg-dark-primary">
            <Header />
            <main className="max-w-container mx-auto px-4 py-8">
                <Outlet />
            </main>
        </div>
    );
};

export default MainLayout;
