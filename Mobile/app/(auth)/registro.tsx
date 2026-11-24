import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { Text, type TextInputInstance } from 'react-native';

import { mensagemDeErro } from '@/api/erros';
import { useSessao } from '@/auth/SessaoContext';
import { Botao } from '@/components/Botao';
import { Campo, CampoSenha, type CampoSenhaRef } from '@/components/Campo';
import { TelaFormulario } from '@/components/Tela';
import { type FormularioRegistro, validarRegistro } from '@dominio/conta';

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
  const campoEmail = useRef<TextInputInstance>(null);
  const campoSenha = useRef<CampoSenhaRef>(null);
  const campoConfirmacao = useRef<CampoSenhaRef>(null);

  const campo = (chave: keyof FormularioRegistro) => (valor: string) =>
    setForm((atual) => ({ ...atual, [chave]: valor }));

  async function enviar() {
    campoSenha.current?.ocultar();
    campoConfirmacao.current?.ocultar();
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
      <Text className="text-titulo-tela font-bold text-texto-forte">{textos.titulo}</Text>
      <Campo
        rotulo={textos.nome}
        value={form.nome}
        onChangeText={campo('nome')}
        autoComplete="name"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => campoEmail.current?.focus()}
      />
      <Campo
        ref={campoEmail}
        rotulo={textos.email}
        value={form.email}
        onChangeText={campo('email')}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => campoSenha.current?.focus()}
      />
      <CampoSenha
        ref={campoSenha}
        rotulo={textos.senha}
        value={form.senha}
        onChangeText={campo('senha')}
        autoComplete="new-password"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => campoConfirmacao.current?.focus()}
      />
      <CampoSenha
        ref={campoConfirmacao}
        rotulo={textos.confirmacao}
        value={form.confirmacao}
        onChangeText={campo('confirmacao')}
        autoComplete="new-password"
        returnKeyType="go"
        onSubmitEditing={enviar}
      />
      {erro ? (
        <Text accessibilityRole="alert" className="text-corpo text-erro">
          {erro}
        </Text>
      ) : null}
      <Botao titulo={textos.criar} onPress={enviar} carregando={enviando} />
      <Link href="/login" replace className="text-center text-corpo text-marca-texto">
        {textos.temConta}
      </Link>
    </TelaFormulario>
  );
}
