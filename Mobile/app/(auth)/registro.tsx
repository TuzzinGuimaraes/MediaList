import { Link } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { mensagemDeErro } from '@/api/erros';
import { useSessao } from '@/auth/SessaoContext';
import { Botao } from '@/components/Botao';
import { Campo } from '@/components/Campo';
import { TelaFormulario } from '@/components/Tela';
import { type FormularioRegistro, validarRegistro } from '@/dominio/conta';

const textos = {
  titulo: 'Criar conta',
  nome: 'Nome',
  email: 'Email',
  senha: 'Senha',
  confirmacao: 'Confirmar senha',
  criar: 'Criar conta',
  temConta: 'Já tem conta? Entrar',
};

export default function Registro() {
  const { registrar } = useSessao();
  const [form, setForm] = useState<FormularioRegistro>({
    nome: '',
    email: '',
    senha: '',
    confirmacao: '',
  });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const campo = (chave: keyof FormularioRegistro) => (valor: string) =>
    setForm((atual) => ({ ...atual, [chave]: valor }));

  async function enviar() {
    const invalido = validarRegistro(form);
    if (invalido) return setErro(invalido);
    setErro(null);
    setEnviando(true);
    try {
      await registrar({ nome_completo: form.nome.trim(), email: form.email.trim(), senha: form.senha });
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEnviando(false);
    }
  }

  return (
    <TelaFormulario>
      <Text className="text-titulo-tela font-bold text-text-bright">{textos.titulo}</Text>
      <Campo rotulo={textos.nome} value={form.nome} onChangeText={campo('nome')} autoComplete="name" />
      <Campo
        rotulo={textos.email}
        value={form.email}
        onChangeText={campo('email')}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <Campo
        rotulo={textos.senha}
        value={form.senha}
        onChangeText={campo('senha')}
        secureTextEntry
        autoComplete="new-password"
      />
      <Campo
        rotulo={textos.confirmacao}
        value={form.confirmacao}
        onChangeText={campo('confirmacao')}
        secureTextEntry
        autoComplete="new-password"
      />
      {erro ? (
        <Text accessibilityRole="alert" className="text-corpo text-accent-red">
          {erro}
        </Text>
      ) : null}
      <Botao titulo={textos.criar} onPress={enviar} carregando={enviando} />
      <Link href="/login" replace className="text-center text-corpo text-accent-blue">
        {textos.temConta}
      </Link>
    </TelaFormulario>
  );
}
