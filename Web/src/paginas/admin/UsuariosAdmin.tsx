// Aba Usuários da Administração: ativar e desativar, 20 por página. Ninguém modera a si
// mesmo nem outro admin.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { rotuloNivelAcesso } from '@dominio/conta';
import { formatarData } from '@dominio/datas';

import { chaves } from '../../api/chaves';
import { exigir } from '../../api/cliente';
import { mensagemDeErro } from '../../api/erros';
import { paginacao } from '../../api/paginacao';
import type { Esquemas } from '../../api/tipos';
import { Botao } from '../../componentes/Botao';
import { Carregando, ErroTela, Vazio } from '../../componentes/Estados';
import { Paginacao } from '../../componentes/Paginacao';
import { Selo } from '../../componentes/Selo';
import { useApi, useUsuario } from '../../sessao/SessaoContext';
import { Aviso } from './Aviso';

const USUARIOS_POR_PAGINA = 20;

const contar = (n: number, singular: string, plural: string) => `${n} ${n === 1 ? singular : plural}`;

export function UsuariosAdmin() {
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
