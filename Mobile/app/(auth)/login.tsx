import { Link } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { mensagemDeErro } from '@/api/erros';
import { useSessao } from '@/auth/SessaoContext';
import { Botao } from '@/components/Botao';
import { Campo } from '@/components/Campo';
import { TelaFormulario } from '@/components/Tela';
import { validarLogin } from '@/dominio/conta';

const textos = {
  titulo: 'MediaList',
  subtitulo: 'Entre para acompanhar sua Lista pessoal.',
  email: 'Email',
  senha: 'Senha',
  entrar: 'Entrar',
  semConta: 'Não tem conta? Criar conta',
};

export default function Login() {
  const { entrar } = useSessao();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    const invalido = validarLogin({ email, senha });
    if (invalido) return setErro(invalido);
    setErro(null);
    setEnviando(true);
    try {
      await entrar(email.trim(), senha);
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEnviando(false);
    }
  }

  return (
    <TelaFormulario>
      <Text className="text-3xl font-bold text-text-bright">{textos.titulo}</Text>
      <Text className="text-text-secondary">{textos.subtitulo}</Text>
      <Campo
        rotulo={textos.email}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <Campo
        rotulo={textos.senha}
        value={senha}
        onChangeText={setSenha}
        secureTextEntry
        autoComplete="password"
      />
      {erro ? (
        <Text accessibilityRole="alert" className="text-accent-red">
          {erro}
        </Text>
      ) : null}
      <Botao titulo={textos.entrar} onPress={enviar} carregando={enviando} />
      <Link href="/registro" className="text-center text-accent-blue">
        {textos.semConta}
      </Link>
    </TelaFormulario>
  );
}
