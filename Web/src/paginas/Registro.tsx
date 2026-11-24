import { Link, useRouter, useSearch } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';

import { Botao } from '../componentes/Botao';
import { Campo, CampoSenha } from '../componentes/Campo';
import { useSessao } from '../sessao/SessaoContext';
import { destinoSeguro, useErroDeFormulario } from './acesso';
import { TelaDeAcesso } from './TelaDeAcesso';

export function Registro() {
  const { registrar } = useSessao();
  const router = useRouter();
  const { redirecionar } = useSearch({ from: '/registro' });
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const { setErro, mensagem, detalhes } = useErroDeFormulario();

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      await registrar({ nome_completo: nome.trim(), email: email.trim(), senha });
      router.history.push(destinoSeguro(redirecionar));
    } catch (falha) {
      setErro(falha);
      setEnviando(false);
    }
  }

  return (
    <TelaDeAcesso
      titulo="Criar conta"
      rodape={
        <>
          Já tem conta?{' '}
          <Link to="/entrar" search={{ redirecionar }} className="font-semibold text-marca-texto hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
        <Campo
          rotulo="Nome"
          autoComplete="name"
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          erro={detalhes.nome_completo}
        />
        <Campo
          rotulo="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          erro={detalhes.email}
        />
        <CampoSenha
          rotulo="Senha"
          autoComplete="new-password"
          required
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          erro={detalhes.senha}
        />
        {mensagem ? (
          <p role="alert" className="text-[14px] text-erro">
            {mensagem}
          </p>
        ) : null}
        <Botao type="submit" tamanho="grande" carregando={enviando}>
          Criar conta
        </Botao>
      </form>
    </TelaDeAcesso>
  );
}
