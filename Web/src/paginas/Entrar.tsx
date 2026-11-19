import { Link, useRouter, useSearch } from '@tanstack/react-router';
import { type FormEvent, useState } from 'react';

import { Botao } from '../componentes/Botao';
import { Campo } from '../componentes/Campo';
import { useSessao } from '../sessao/SessaoContext';
import { destinoSeguro, useErroDeFormulario } from './acesso';
import { TelaDeAcesso } from './TelaDeAcesso';

export function Entrar() {
  const { entrar } = useSessao();
  const router = useRouter();
  const { redirecionar } = useSearch({ from: '/entrar' });
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const { setErro, mensagem, detalhes } = useErroDeFormulario();

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      await entrar(email.trim(), senha);
      router.history.push(destinoSeguro(redirecionar));
    } catch (falha) {
      setErro(falha);
      setEnviando(false);
    }
  }

  return (
    <TelaDeAcesso
      titulo="Entrar"
      rodape={
        <>
          Ainda não tem conta?{' '}
          <Link to="/registro" search={{ redirecionar }} className="font-semibold text-marca-texto hover:underline">
            Criar conta
          </Link>
        </>
      }
    >
      <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
        <Campo
          rotulo="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          erro={detalhes.email}
        />
        <Campo
          rotulo="Senha"
          type="password"
          autoComplete="current-password"
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
          Entrar
        </Botao>
      </form>
    </TelaDeAcesso>
  );
}
