// Administração (só admin, ADR 0012): moderação de Usuários (ativar/desativar, paginado) e
// das Avaliações recentes (excluir). Ninguém ativa ou desativa a si mesmo nem outro admin.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import { rotuloNivelAcesso } from '@dominio/conta';
import { formatarData } from '@dominio/datas';
import { nomeDoTipo } from '@dominio/estadoConsumo';
import { tituloDaMidia } from '@dominio/midia';

import { chaves } from '../api/chaves';
import { exigir } from '../api/cliente';
import { mensagemDeErro } from '../api/erros';
import { paginacao } from '../api/paginacao';
import type { Esquemas } from '../api/tipos';
import { Botao } from '../componentes/Botao';
import { Modal } from '../componentes/Camada';
import { Carregando, ErroTela, Vazio } from '../componentes/Estados';
import { Paginacao } from '../componentes/Paginacao';
import { Selo } from '../componentes/Selo';
import { useApi, useUsuario } from '../sessao/SessaoContext';

export const USUARIOS_POR_PAGINA = 20;

type Aba = 'usuarios' | 'avaliacoes';

const ABAS: { valor: Aba; nome: string }[] = [
  { valor: 'usuarios', nome: 'Usuários' },
  { valor: 'avaliacoes', nome: 'Avaliações' },
];

const contar = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;

function Aviso({ texto }: { texto: string | null }) {
  return texto ? (
    <p role="alert" className="rounded-md border border-erro/40 bg-erro/10 p-3 text-[14px] text-erro">
      {texto}
    </p>
  ) : null;
}

function Usuarios() {
  const api = useApi();
  const eu = useUsuario();
  const queryClient = useQueryClient();
  const [pagina, setPagina] = useState(1);

  const consulta = useQuery({
    queryKey: chaves.moderacao.usuariosDaPagina(pagina),
    queryFn: () =>
      exigir(api.GET('/api/moderacao/usuarios', { params: { query: { pagina, por_pagina: USUARIOS_POR_PAGINA } } })),
    placeholderData: keepPreviousData,
  });

  const alternar = useMutation({
    mutationFn: ({ id, ativar }: { id: string; ativar: boolean }) =>
      exigir(
        ativar
          ? api.PUT('/api/moderacao/usuarios/{target_user_id}/ativar', { params: { path: { target_user_id: id } } })
          : api.PUT('/api/moderacao/usuarios/{target_user_id}/desativar', { params: { path: { target_user_id: id } } }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: chaves.moderacao.usuarios }),
  });

  if (!consulta.data) {
    return consulta.isError ? (
      <ErroTela erro={consulta.error} tentarDeNovo={() => void consulta.refetch()} />
    ) : (
      <Carregando rotulo="Carregando Usuários" />
    );
  }
  if (!consulta.data.itens.length) return <Vazio texto="Nenhum Usuário cadastrado." />;

  const moderavel = (u: Esquemas['UsuarioModeracao']) => u.id_usuario !== eu.id && u.nivel_acesso !== 'admin';

  return (
    <div className="flex flex-col gap-4">
      <Aviso texto={alternar.isError ? mensagemDeErro(alternar.error) : null} />
      <ul className="flex flex-col gap-2">
        {consulta.data.itens.map((u) => {
          const desde = formatarData(u.data_cadastro);
          const alterando = alternar.isPending && alternar.variables?.id === u.id_usuario;
          return (
            <li
              key={u.id_usuario}
              aria-label={u.nome_completo}
              className="flex items-center justify-between gap-4 rounded-lg bg-superficie px-5 py-4"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-texto-forte">{u.nome_completo}</span>
                  <Selo texto={rotuloNivelAcesso(u.nivel_acesso)} tom={u.nivel_acesso === 'admin' ? 'marca' : 'neutro'} />
                  {u.ativo ? null : <Selo texto="Inativo" />}
                </div>
                <span className="truncate text-[13px] text-texto-suave">{u.email}</span>
                <span className="text-[13px] text-texto-suave">
                  {contar(u.total_midias, 'Mídia', 'Mídias')} · {contar(u.total_avaliacoes, 'Avaliação', 'Avaliações')}
                  {desde ? ` · desde ${desde}` : ''}
                </span>
              </div>
              {moderavel(u) ? (
                <Botao
                  variante={u.ativo ? 'secundario' : 'primario'}
                  carregando={alterando}
                  onClick={() => alternar.mutate({ id: u.id_usuario, ativar: !u.ativo })}
                >
                  {u.ativo ? 'Desativar' : 'Ativar'}
                </Botao>
              ) : null}
            </li>
          );
        })}
      </ul>
      <Paginacao paginacao={paginacao(consulta.data)} ir={setPagina} />
    </div>
  );
}

function Avaliacoes() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [excluindo, setExcluindo] = useState<Esquemas['AvaliacaoModeracao'] | null>(null);

  const consulta = useQuery({
    queryKey: chaves.moderacao.avaliacoes,
    queryFn: () => exigir(api.GET('/api/moderacao/avaliacoes')),
  });

  const excluir = useMutation({
    mutationFn: (id: string) => exigir(api.DELETE('/api/avaliacoes/{avaliacao_id}', { params: { path: { avaliacao_id: id } } })),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: chaves.moderacao.avaliacoes });
      setExcluindo(null);
    },
  });

  if (!consulta.data) {
    return consulta.isError ? (
      <ErroTela erro={consulta.error} tentarDeNovo={() => void consulta.refetch()} />
    ) : (
      <Carregando rotulo="Carregando Avaliações" />
    );
  }
  const { avaliacoes } = consulta.data;
  if (!avaliacoes.length) return <Vazio texto="Nenhuma Avaliação para moderar." />;

  const fechar = () => {
    if (excluir.isPending) return;
    excluir.reset();
    setExcluindo(null);
  };

  return (
    <>
      <p className="text-[14px] text-texto-suave">As 50 Avaliações mais recentes.</p>
      <ul className="flex flex-col gap-2">
        {avaliacoes.map((a) => {
          const titulo = a.titulo_avaliacao || 'Sem título';
          const data = formatarData(a.data_avaliacao);
          return (
            <li key={a.id_avaliacao} aria-label={titulo} className="flex flex-col gap-2 rounded-lg bg-superficie px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-bold text-texto-forte">{titulo}</span>
                  <span className="text-[13px] text-texto-suave">
                    Por {a.nome_completo} ·{' '}
                    <Link to="/midia/$id" params={{ id: a.id_midia }} className="font-semibold text-marca-texto hover:underline">
                      {tituloDaMidia(a)}
                    </Link>{' '}
                    · {nomeDoTipo(a.tipo)} · Nota <span className="font-semibold text-texto">{a.nota}</span>
                    {data ? ` · ${data}` : ''}
                  </span>
                </div>
                <Botao variante="secundario" onClick={() => setExcluindo(a)}>
                  Excluir
                </Botao>
              </div>
              {a.texto_avaliacao ? <p className="whitespace-pre-line text-[14px] text-texto">{a.texto_avaliacao}</p> : null}
            </li>
          );
        })}
      </ul>
      <Modal
        titulo="Excluir Avaliação"
        aberto={excluindo !== null}
        fechar={fechar}
        rodape={
          <>
            <Botao variante="secundario" onClick={fechar} disabled={excluir.isPending}>
              Cancelar
            </Botao>
            <Botao carregando={excluir.isPending} onClick={() => excluindo && excluir.mutate(excluindo.id_avaliacao)}>
              Excluir
            </Botao>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-texto">
            Excluir a Avaliação “{excluindo?.titulo_avaliacao || 'Sem título'}” de {excluindo?.nome_completo}? Não dá para
            desfazer.
          </p>
          <Aviso texto={excluir.isError ? mensagemDeErro(excluir.error) : null} />
        </div>
      </Modal>
    </>
  );
}

export function Admin() {
  const [aba, setAba] = useState<Aba>('usuarios');
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
      <h1 className="text-[28px] font-bold text-texto-forte">Administração</h1>
      <div role="tablist" aria-label="Moderação" className="flex gap-1 border-b border-borda">
        {ABAS.map((a) => (
          <button
            key={a.valor}
            type="button"
            role="tab"
            id={`aba-${a.valor}`}
            aria-selected={aba === a.valor}
            aria-controls={`painel-${a.valor}`}
            onClick={() => setAba(a.valor)}
            className={`-mb-px min-h-11 border-b-2 px-4 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-marca-texto ${
              aba === a.valor ? 'border-marca text-texto-forte' : 'border-transparent text-texto-suave hover:text-texto-forte'
            }`}
          >
            {a.nome}
          </button>
        ))}
      </div>
      <section role="tabpanel" id={`painel-${aba}`} aria-labelledby={`aba-${aba}`} className="flex flex-col gap-4">
        {aba === 'usuarios' ? <Usuarios /> : <Avaliacoes />}
      </section>
    </main>
  );
}
