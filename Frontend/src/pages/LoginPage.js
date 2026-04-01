import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
    const { login, register } = useAuth();
    const navigate = useNavigate();
    const [isRegistro, setIsRegistro] = useState(false);
    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        nome_completo: '',
        email: '',
        senha: '',
        data_nascimento: ''
    });
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (isRegistro) {
            const result = await register(formData);
            if (result.success) {
                navigate('/');
            } else {
                setError(result.error);
            }
        } else {
            const result = await login(email, senha);
            if (result.success) {
                navigate('/');
            } else {
                setError(result.error);
            }
        }
    };

    return (
        <div className="w-full max-w-md">
            <div className="bg-dark-secondary rounded-lg border border-dark-border p-8">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-accent-blue mb-2">MediaList</h1>
                    <p className="text-text-secondary text-sm">
                        {isRegistro ? 'Crie sua conta' : 'Gerencie animes, mangás e jogos'}
                    </p>
                </div>

                {error && (
                    <div className="bg-accent-red/10 border border-accent-red/30 text-accent-red text-sm rounded-lg p-3 mb-4">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {isRegistro && (
                        <>
                            <input
                                type="text"
                                placeholder="Nome Completo"
                                className="w-full px-4 py-3 bg-dark-primary border border-dark-border rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent-blue transition-colors"
                                value={formData.nome_completo}
                                onChange={(e) => setFormData({ ...formData, nome_completo: e.target.value })}
                                required
                            />
                            <input
                                type="email"
                                placeholder="Email"
                                className="w-full px-4 py-3 bg-dark-primary border border-dark-border rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent-blue transition-colors"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                required
                            />
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Senha"
                                    className="w-full px-4 py-3 bg-dark-primary border border-dark-border rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent-blue transition-colors pr-12"
                                    value={formData.senha}
                                    onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            <input
                                type="date"
                                placeholder="Data de Nascimento"
                                className="w-full px-4 py-3 bg-dark-primary border border-dark-border rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent-blue transition-colors"
                                value={formData.data_nascimento}
                                onChange={(e) => setFormData({ ...formData, data_nascimento: e.target.value })}
                            />
                        </>
                    )}

                    {!isRegistro && (
                        <>
                            <input
                                type="email"
                                placeholder="Email"
                                className="w-full px-4 py-3 bg-dark-primary border border-dark-border rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent-blue transition-colors"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Senha"
                                    className="w-full px-4 py-3 bg-dark-primary border border-dark-border rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:border-accent-blue transition-colors pr-12"
                                    value={senha}
                                    onChange={(e) => setSenha(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </>
                    )}

                    <button
                        type="submit"
                        className="w-full bg-accent-blue hover:bg-accent-blue-hover text-white py-3 rounded-lg font-semibold transition-colors"
                    >
                        {isRegistro ? 'Registrar' : 'Entrar'}
                    </button>

                    <button
                        type="button"
                        onClick={() => { setIsRegistro(!isRegistro); setError(''); }}
                        className="w-full text-accent-blue hover:text-accent-blue-hover font-medium text-sm transition-colors"
                    >
                        {isRegistro ? 'Já tem uma conta? Faça login' : 'Criar nova conta'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;
