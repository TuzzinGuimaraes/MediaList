import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Esquemas } from '../api/tipos';
import { abrirLogado } from '../testes/app';
import type { Rotas } from '../testes/fetchSimulado';

type Notificacao = Esquemas['Notificacao'];

function notificacao(titulo: string, lida: boolean, midia = 'Frieren'): Notificacao {
  return {
    titulo,
    mensagem: `Mensagem de ${titulo}`,
    lida,
    id_midia: 'MID-1',
    midia_nome: midia,
    tipo: 'episodio',
    tipo_midia: 'anime',
    data_criacao: '2026-11-04T09:00:00',
  };
}

/** GET /notificacoes que reflete o "Marcar todas como lidas". */
function rotasDoSino(iniciais: Notificacao[]): Rotas {
  let notificacoes = iniciais;
  return {
    'GET /notificacoes': () => ({ status: 200, corpo: { notificacoes } }),
    'PUT /notificacoes/marcar-todas-lidas': () => {
      notificacoes = notificacoes.map((n) => ({ ...n, lida: true }));
      return { status: 200, corpo: { mensagem: 'ok' } };
    },
    'GET /usuario/perfil': { status: 500 },
    'GET /usuario/estatisticas': { status: 500 },
    'GET /lista': { status: 200, corpo: { lista: [] } },
  };
}

const sino = (nome: RegExp | string = /^Notificações/) => screen.findByRole('button', { name: nome });

describe('sino de Notificações na nav', () => {
  it('sem não lidas, o sino fica sem o ponto', async () => {
    await abrirLogado('/lista', { rotas: rotasDoSino([notificacao('Episódio 11', true)]) });

    const botao = await sino('Notificações');
    expect(within(botao).queryByTestId('ponto-nao-lidas')).not.toBeInTheDocument();
  });

  it('com não lidas, mostra o ponto e diz quantas', async () => {
    await abrirLogado('/lista', {
      rotas: rotasDoSino([notificacao('Episódio 12', false), notificacao('Episódio 3', false, 'Berserk'), notificacao('Episódio 11', true)]),
    });

    const botao = await sino('Notificações, 2 não lidas');
    expect(within(botao).getByTestId('ponto-nao-lidas')).toBeInTheDocument();
  });

  it('o painel mostra as recentes e marca todas como lidas', async () => {
    const { user, api } = await abrirLogado('/lista', {
      rotas: rotasDoSino([notificacao('Episódio 12', false), notificacao('Episódio 11', true)]),
    });

    await user.click(await sino('Notificações, 1 não lida'));
    const painel = screen.getByRole('dialog', { name: 'Notificações' });
    expect(within(painel).getByRole('listitem', { name: /Episódio 12/ })).toHaveTextContent('Frieren · 04/11/2026');
    expect(within(painel).getByRole('listitem', { name: /Episódio 11/ })).toBeInTheDocument();

    await user.click(within(painel).getByRole('button', { name: 'Marcar todas como lidas' }));

    expect(api.para('PUT /notificacoes/marcar-todas-lidas')).toHaveLength(1);
    expect(await sino('Notificações')).toBeInTheDocument();
    await waitFor(() =>
      expect(within(painel).queryByRole('button', { name: 'Marcar todas como lidas' })).not.toBeInTheDocument(),
    );
  });

  it('o painel mostra só as 5 mais recentes e leva ao Perfil para ver todas', async () => {
    const muitas = Array.from({ length: 7 }, (_, i) => notificacao(`Episódio ${7 - i}`, false));
    const { user, historico } = await abrirLogado('/lista', { rotas: rotasDoSino(muitas) });

    await user.click(await sino(/^Notificações, 7/));
    const painel = screen.getByRole('dialog', { name: 'Notificações' });
    expect(within(painel).getAllByRole('listitem')).toHaveLength(5);

    await user.click(within(painel).getByRole('link', { name: 'Ver todas no Perfil' }));

    await waitFor(() => expect(historico.location.pathname).toBe('/perfil'));
    expect(screen.queryByRole('dialog', { name: 'Notificações' })).not.toBeInTheDocument();
  });

  it('Esc fecha o painel e devolve o foco ao sino', async () => {
    const { user } = await abrirLogado('/lista', { rotas: rotasDoSino([notificacao('Episódio 12', false)]) });

    const botao = await sino(/^Notificações/);
    await user.click(botao);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'Notificações' })).not.toBeInTheDocument();
    expect(botao).toHaveFocus();
  });

  it('o sino e o Perfil dividem a mesma consulta', async () => {
    const { api } = await abrirLogado('/perfil', { rotas: rotasDoSino([notificacao('Episódio 12', false)]) });

    await sino('Notificações, 1 não lida');
    await screen.findByRole('region', { name: 'Notificações' });

    expect(api.para('GET /notificacoes')).toHaveLength(1);
  });
});
