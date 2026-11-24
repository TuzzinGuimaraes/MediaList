import { validarNovaSenha } from '@dominio/conta';
import { type FormEvent, useState } from 'react';

import { Botao } from '../componentes/Botao';
import { CampoSenha } from '../componentes/Campo';
import { useSessao } from '../sessao/SessaoContext';
import { useErroDeFormulario } from './acesso';
import { TelaDeAcesso } from './TelaDeAcesso';

/**
 * "Defina sua nova senha": quem entrou com uma Senha temporária (CONTEXT.md) fica aqui até
 * trocá-la ou sair da conta. Fica no lugar das rotas (App.tsx), então não há para onde navegar.
 */
export function DefinirSenha({ nome }: { nome: string }) {
  const { trocarSenha, sair } = useSessao();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [invalida, setInvalida] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const { setErro, mensagem, detalhes } = useErroDeFormulario();

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    const problema = validarNovaSenha({ senhaAtual, novaSenha, confirmacao });
    setInvalida(problema);
    if (problema) return;
    setEnviando(true);
    try {
      await trocarSenha(senhaAtual, novaSenha);
    } catch (falha) {
      setErro(falha);
      setEnviando(false);
    }
  }

  const alerta = invalida ?? mensagem;
  return (
    <TelaDeAcesso
      titulo="Defina sua nova senha"
      rodape={
        <>
          Não é {nome}?{' '}
          <button type="button" onClick={() => void sair()} className="font-semibold text-marca-texto hover:underline">
            Sair da conta
          </button>
        </>
      }
    >
      <p className="text-[15px] text-texto-suave">
        Olá, {nome}. Você entrou com uma senha temporária: escolha uma senha nova para continuar.
      </p>
      <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
        <CampoSenha
          rotulo="Senha temporária"
          autoComplete="current-password"
          required
          value={senhaAtual}
          onChange={(e) => setSenhaAtual(e.target.value)}
          erro={detalhes.senha_atual}
        />
        <CampoSenha
          rotulo="Nova senha"
          autoComplete="new-password"
          required
          value={novaSenha}
          onChange={(e) => setNovaSenha(e.target.value)}
          erro={detalhes.nova_senha}
        />
        <CampoSenha
          rotulo="Confirme a nova senha"
          autoComplete="new-password"
          required
          value={confirmacao}
          onChange={(e) => setConfirmacao(e.target.value)}
        />
        {alerta ? (
          <p role="alert" className="text-[14px] text-erro">
            {alerta}
          </p>
        ) : null}
        <Botao type="submit" tamanho="grande" carregando={enviando}>
          Salvar nova senha
        </Botao>
      </form>
    </TelaDeAcesso>
  );
}
