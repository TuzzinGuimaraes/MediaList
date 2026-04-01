import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, Search, Shield, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useApi } from '../../contexts/ApiContext';
import { useSession, SESSIONS } from '../../contexts/SessionContext';

const ANIMANGA_LINKS = [
    { to: '/', label: 'Home', exact: true },
    { to: '/anime-list', label: 'Anime List' },
    { to: '/manga-list', label: 'Manga List' },
    { to: '/browse', label: 'Browse' },
    { to: '/stats', label: 'Stats' },
];

const JOGOS_LINKS = [
    { to: '/', label: 'Home', exact: true },
    { to: '/game-list', label: 'Game List' },
    { to: '/browse?tipo=jogo', label: 'Browse' },
    { to: '/stats', label: 'Stats' },
];

const Header = () => {
    const { user, permissions, logout } = useAuth();
    const { apiCall } = useApi();
    const { sessao, setSessao } = useSession();
    const navigate = useNavigate();
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [notificacoes, setNotificacoes] = useState([]);
    const [notificacoesLoaded, setNotificacoesLoaded] = useState(false);

    const navLinks = sessao === 'animanga' ? ANIMANGA_LINKS : JOGOS_LINKS;

    const handleBellClick = async () => {
        if (!notificacoesLoaded) {
            try {
                const data = await apiCall('/notificacoes?nao_lidas=true');
                setNotificacoes(data.notificacoes || []);
                setNotificacoesLoaded(true);
            } catch (e) {
                console.error('Erro ao carregar notificações:', e);
            }
        }
        setShowNotifications(!showNotifications);
    };

    const marcarTodasLidas = async () => {
        try {
            await apiCall('/notificacoes/marcar-todas-lidas', { method: 'PUT' });
            setNotificacoes([]);
            setShowNotifications(false);
        } catch (e) {
            console.error('Erro ao marcar notificações:', e);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const navLinkClass = ({ isActive }) =>
        `text-sm font-semibold transition-colors ${isActive ? 'text-accent-blue' : 'text-text-secondary hover:text-text-bright'}`;

    return (
        <header className="bg-dark-nav border-b border-dark-border sticky top-0 z-50">
            <div className="max-w-container mx-auto px-4 h-14 flex items-center justify-between">
                {/* Logo */}
                <NavLink to="/" className="text-xl font-bold text-text-bright tracking-tight mr-4">
                    MediaList
                </NavLink>

                {/* Session Switcher */}
                <div className="hidden lg:flex items-center gap-1 mr-6">
                    {Object.values(SESSIONS).map(s => (
                        <button
                            key={s.id}
                            onClick={() => setSessao(s.id)}
                            className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                                sessao === s.id
                                    ? 'bg-accent-blue text-white'
                                    : 'text-text-secondary hover:text-text-bright hover:bg-dark-secondary'
                            }`}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>

                {/* Nav Links - Desktop */}
                <nav className="hidden lg:flex items-center gap-6 flex-1">
                    {navLinks.map(link => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            className={navLinkClass}
                            end={link.exact}
                        >
                            {link.label}
                        </NavLink>
                    ))}
                </nav>

                {/* Right Side */}
                <div className="flex items-center gap-4">
                    {/* Search */}
                    <button
                        onClick={() => navigate('/browse')}
                        className="text-text-secondary hover:text-text-bright transition-colors"
                    >
                        <Search size={20} />
                    </button>

                    {/* Notifications */}
                    <div className="relative">
                        <button
                            onClick={handleBellClick}
                            className="text-text-secondary hover:text-text-bright transition-colors relative"
                        >
                            <Bell size={20} />
                            {notificacoes.length > 0 && (
                                <span className="absolute -top-1 -right-1 bg-accent-red text-white text-xs rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                                    {notificacoes.length}
                                </span>
                            )}
                        </button>

                        {showNotifications && (
                            <div className="absolute right-0 mt-2 w-80 bg-dark-tertiary rounded-lg border border-dark-border shadow-xl z-50">
                                <div className="p-3 border-b border-dark-border flex justify-between items-center">
                                    <h3 className="font-semibold text-text-bright text-sm">Notificações</h3>
                                    {notificacoes.length > 0 && (
                                        <button
                                            onClick={marcarTodasLidas}
                                            className="text-xs text-accent-blue hover:text-accent-blue-hover"
                                        >
                                            Marcar todas como lidas
                                        </button>
                                    )}
                                </div>
                                <div className="max-h-80 overflow-y-auto">
                                    {notificacoes.length === 0 ? (
                                        <div className="p-4 text-center text-text-secondary text-sm">
                                            Nenhuma notificação nova
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-dark-border">
                                            {notificacoes.slice(0, 5).map((notif, index) => (
                                                <div key={index} className="p-3 hover:bg-dark-secondary transition-colors">
                                                    <p className="text-sm font-semibold text-text-bright">
                                                        {notif.titulo || 'Nova notificação'}
                                                    </p>
                                                    <p className="text-xs text-text-secondary mt-1">
                                                        {notif.mensagem || `Novidade: ${notif.midia_nome || notif.anime_nome || 'Mídia'}`}
                                                    </p>
                                                    {(notif.data_criacao || notif.data) && (
                                                        <p className="text-xs text-text-secondary mt-1 opacity-60">
                                                            {new Date(notif.data_criacao || notif.data).toLocaleDateString('pt-BR')}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Admin */}
                    {(permissions?.pode_moderar || permissions?.nivel_acesso === 'admin') && (
                        <NavLink
                            to="/admin"
                            className={navLinkClass}
                        >
                            <Shield size={20} />
                        </NavLink>
                    )}

                    {/* User Avatar + Logout */}
                    <div className="hidden md:flex items-center gap-3">
                        <NavLink to="/profile" className="flex items-center gap-2 group">
                            <div className="w-8 h-8 bg-dark-tertiary rounded-full flex items-center justify-center text-text-secondary group-hover:text-accent-blue transition-colors border border-dark-border">
                                <span className="text-sm font-bold">{user?.nome?.[0]?.toUpperCase() || 'U'}</span>
                            </div>
                        </NavLink>
                        <button
                            onClick={handleLogout}
                            className="text-text-secondary hover:text-accent-red transition-colors"
                            title="Sair"
                        >
                            <LogOut size={18} />
                        </button>
                    </div>

                    {/* Mobile Menu Toggle */}
                    <button
                        onClick={() => setShowMobileMenu(!showMobileMenu)}
                        className="lg:hidden text-text-secondary hover:text-text-bright"
                    >
                        {showMobileMenu ? <X size={22} /> : <Menu size={22} />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            {showMobileMenu && (
                <div className="lg:hidden bg-dark-nav border-t border-dark-border px-4 py-3 space-y-1">
                    {/* Mobile Session Switcher */}
                    <div className="flex gap-2 mb-3">
                        {Object.values(SESSIONS).map(s => (
                            <button
                                key={s.id}
                                onClick={() => setSessao(s.id)}
                                className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                                    sessao === s.id
                                        ? 'bg-accent-blue text-white'
                                        : 'bg-dark-secondary text-text-secondary'
                                }`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>

                    {navLinks.map(link => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            onClick={() => setShowMobileMenu(false)}
                            className={({ isActive }) =>
                                `block py-2 px-3 rounded text-sm transition-colors ${isActive ? 'text-accent-blue bg-dark-secondary' : 'text-text-secondary hover:text-text-bright hover:bg-dark-secondary'}`
                            }
                            end={link.exact}
                        >
                            {link.label}
                        </NavLink>
                    ))}
                    {(permissions?.pode_moderar || permissions?.nivel_acesso === 'admin') && (
                        <NavLink
                            to="/admin"
                            onClick={() => setShowMobileMenu(false)}
                            className={({ isActive }) =>
                                `block py-2 px-3 rounded text-sm transition-colors ${isActive ? 'text-accent-blue bg-dark-secondary' : 'text-text-secondary hover:text-text-bright hover:bg-dark-secondary'}`
                            }
                        >
                            Admin
                        </NavLink>
                    )}
                    <NavLink
                        to="/profile"
                        onClick={() => setShowMobileMenu(false)}
                        className="block py-2 px-3 rounded text-sm text-text-secondary hover:text-text-bright hover:bg-dark-secondary"
                    >
                        Perfil ({user?.nome})
                    </NavLink>
                    <button
                        onClick={() => { handleLogout(); setShowMobileMenu(false); }}
                        className="block w-full text-left py-2 px-3 rounded text-sm text-accent-red hover:bg-dark-secondary"
                    >
                        Sair
                    </button>
                </div>
            )}
        </header>
    );
};

export default Header;
