import { Redirect } from 'expo-router';
import { useRef, useState } from 'react';
import { Text } from 'react-native';

import { mensagemDeErro } from '@/api/erros';
import { useSessao } from '@/auth/SessaoContext';
import { Botao } from '@/components/Botao';
import { CampoSenha, type CampoSenhaRef } from '@/components/Campo';
import { Carregando } from '@/components/EstadoTela';
import { TelaFormulario } from '@/components/Tela';
import { validarNovaSenha } from '@dominio/conta';

const textos = {
  titulo: 'Defina sua nova senha',
  explicacao: (nome: string) =>
    `Olá, ${nome}. Você entrou com uma senha temporária: escolha uma senha nova para continuar.`,
  atual: 'Senha temporária',
  nova: 'Nova senha',
  confirmacao: 'Confirme a nova senha',
  salvar: 'Salvar nova senha',
  outraPessoa: (nome: string) => `Não é ${nome}?`,
  sair: 'Sair da conta',
};

/**
 * "Defina sua nova senha": quem entrou com uma Senha temporária (CONTEXT.md) fica aqui até
 * trocá-la ou sair da conta. As abas, o login e o detalhe redirecionam para cá enquanto a
 * troca estiver pendente; trocada, a sessão vira autenticada e o redirect leva ao Início.
 */
export default function DefinirSenha() {
  const { sessao } = useSessao();
  if (sessao.estado === 'carregando') return <Carregando />;
  if (sessao.estado === 'anonima') return <Redirect href="/login" />;
  if (sessao.estado === 'autenticada') return <Redirect href="/" />;
  return <Formulario nome={sessao.usuario.nome} />;
}

function Formulario({ nome }: { nome: string }) {
  const { trocarSenha, sair } = useSessao();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const campoAtual = useRef<CampoSenhaRef>(null);
  const campoNova = useRef<CampoSenhaRef>(null);
  const campoConfirmacao = useRef<CampoSenhaRef>(null);

  async function enviar() {
    for (const campo of [campoAtual, campoNova, campoConfirmacao]) campo.current?.ocultar();
    const invalida = validarNovaSenha({ senhaAtual, novaSenha, confirmacao });
    if (invalida) return setErro(invalida);
    setErro(null);
    setEnviando(true);
    try {
      await trocarSenha(senhaAtual, novaSenha);
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEnviando(false);
    }
  }

  return (
    <TelaFormulario>
      <Text accessibilityRole="header" className="text-titulo-tela font-bold text-texto-forte">
        {textos.titulo}
      </Text>
      <Text className="text-corpo text-texto-suave">{textos.explicacao(nome)}</Text>
      <CampoSenha
        ref={campoAtual}
        rotulo={textos.atual}
        value={senhaAtual}
        onChangeText={setSenhaAtual}
        autoComplete="current-password"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => campoNova.current?.focus()}
      />
      <CampoSenha
        ref={campoNova}
        rotulo={textos.nova}
        value={novaSenha}
        onChangeText={setNovaSenha}
        autoComplete="new-password"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => campoConfirmacao.current?.focus()}
      />
      <CampoSenha
        ref={campoConfirmacao}
        rotulo={textos.confirmacao}
        value={confirmacao}
        onChangeText={setConfirmacao}
        autoComplete="new-password"
        returnKeyType="go"
        onSubmitEditing={enviar}
      />
      {erro ? (
        <Text accessibilityRole="alert" className="text-corpo text-erro">
          {erro}
        </Text>
      ) : null}
      <Botao titulo={textos.salvar} onPress={enviar} carregando={enviando} />
      <Text className="text-center text-corpo text-texto-suave">
        {textos.outraPessoa(nome)}{' '}
        <Text
          accessibilityRole="button"
          accessibilityLabel={textos.sair}
          onPress={() => void sair()}
          className="font-semibold text-marca-texto"
        >
          {textos.sair}
        </Text>
      </Text>
    </TelaFormulario>
  );
}
