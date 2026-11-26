import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SessaoProvider } from '../../sessao/SessaoContext';
import { rotasDaSessao } from '../../testes/app';
import { erro, simularFetch } from '../../testes/fetchSimulado';
import { EditorItemProvider, useEditorItem } from './EditorItemContext';
import { type ItemLista, rotasDaLista, umaMidia, umItem } from './fixtures';

afterEach(() => {
  vi.useRealTimers();
});

/** Abre o editor de `item` (como o detalhe faz); PUT e DELETE respondem ok. */
async function editar(item: ItemLista, extra = {}) {
  const api = simularFetch({
    ...rotasDaSessao(),
    ...rotasDaLista([item]),
    [`PUT /lista/${item.id_lista}`]: { status: 200, corpo: { mensagem: 'ok' } },
    [`DELETE /lista/${item.id_lista}`]: { status: 200, corpo: { mensagem: 'ok' } },
    ...extra,
  });
  const user = userEvent.setup();
  const titulo = item.titulo_portugues ?? item.titulo_original;
  function Abrir() {
    const { abrirEditor } = useEditorItem();
    return (
      <button type="button" onClick={() => abrirEditor(item, item)}>
        {`Editar ${titulo}`}
      </button>
    );
  }
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SessaoProvider>
        <EditorItemProvider>
          <Abrir />
        </EditorItemProvider>
      </SessaoProvider>
    </QueryClientProvider>,
  );
  await user.click(screen.getByRole('button', { name: `Editar ${titulo}` }));
  const dialogo = screen.getByRole('dialog', { name: titulo });
  return { api, user, dialogo, put: () => api.para(`PUT /lista/${item.id_lista}`) };
}

describe('editor do Item', () => {
  it('abre com o Item e salva o formulário inteiro no PUT', async () => {
    const item = umItem({ titulo_original: 'Frieren', progresso_atual: 3, nota_usuario: 8, data_inicio: '2026-10-01' });
    const { user, dialogo, put } = await editar(item);

    expect(within(dialogo).getByRole('radio', { name: 'Em progresso' })).toBeChecked();
    expect(within(dialogo).getByLabelText('Episódios (de 12)')).toHaveValue('3');
    expect(within(dialogo).getByLabelText('Início')).toHaveValue('2026-10-01');

    await user.clear(within(dialogo).getByLabelText('Nota pessoal'));
    await user.type(within(dialogo).getByLabelText('Nota pessoal'), '9,5');
    await user.click(within(dialogo).getByRole('switch', { name: 'Favorito' }));
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    expect(put()[0]?.corpo).toEqual({
      status_consumo: 'assistindo',
      progresso_atual: 3,
      nota_usuario: 9.5,
      favorito: true,
      privado: false,
      data_inicio: '2026-10-01',
      data_conclusao: null,
      total_rewatches: 0,
      comentario: null,
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('escolher Concluído leva o Progresso ao total; outro Status devolve o de antes (ticket 33)', async () => {
    const { user, dialogo } = await editar(umItem({ titulo_original: 'Frieren', progresso_atual: 5 }));
    const progresso = within(dialogo).getByLabelText('Episódios (de 12)');

    await user.click(within(dialogo).getByRole('radio', { name: 'Concluído' }));
    expect(progresso).toHaveValue('12');

    await user.click(within(dialogo).getByRole('radio', { name: 'Pausado' }));
    expect(progresso).toHaveValue('5');
    expect(within(dialogo).getByRole('radio', { name: 'Pausado' })).toBeChecked();
  });

  it('Item que abriu concluído zera o Progresso ao escolher outro Status', async () => {
    const { user, dialogo } = await editar(umItem({ titulo_original: 'Frieren', status_consumo: 'completo', progresso_atual: 12 }));

    await user.click(within(dialogo).getByRole('radio', { name: 'Em progresso' }));

    expect(within(dialogo).getByLabelText('Episódios (de 12)')).toHaveValue('0');
  });

  it('Progresso digitado no total vira Concluído', async () => {
    const { user, dialogo } = await editar(umItem({ titulo_original: 'Frieren', progresso_atual: 5 }));
    const progresso = within(dialogo).getByLabelText('Episódios (de 12)');

    await user.clear(progresso);
    await user.type(progresso, '12');

    expect(within(dialogo).getByRole('radio', { name: 'Concluído' })).toBeChecked();
  });

  it('a Recontagem anda com − e +, sem passar de 0', async () => {
    const { user, dialogo, put } = await editar(umItem({ titulo_original: 'Frieren', total_rewatches: 1 }));

    await user.click(within(dialogo).getByRole('button', { name: 'Diminuir Reassistido' }));
    expect(within(dialogo).getByRole('button', { name: 'Diminuir Reassistido' })).toBeDisabled();
    await user.click(within(dialogo).getByRole('button', { name: 'Aumentar Reassistido' }));
    await user.click(within(dialogo).getByRole('button', { name: 'Aumentar Reassistido' }));
    expect(within(dialogo).getByLabelText('Reassistido: 2×')).toBeInTheDocument();

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    expect(put()[0]?.corpo.total_rewatches).toBe(2);
  });

  // As regras de data (futuro, conclusão antes do início) são do domínio, em itemLista.test.ts.
  it('o calendário limita as datas e o erro do domínio aparece no editor', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 14, 12) });
    const { user, dialogo, put } = await editar(umItem({ titulo_original: 'Frieren', data_inicio: '2026-11-01' }));
    const inicio = within(dialogo).getByLabelText('Início');
    const conclusao = within(dialogo).getByLabelText('Conclusão');

    expect(inicio).toHaveAttribute('max', '2026-11-14');
    expect(conclusao).toHaveAttribute('min', '2026-11-01');

    await user.type(conclusao, '2026-10-20');
    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }));
    expect(within(dialogo).getByRole('alert')).toHaveTextContent('A conclusão não pode ser antes do início.');
    expect(put()).toHaveLength(0);

    await user.click(within(dialogo).getByRole('button', { name: 'Limpar Conclusão' }));
    expect(conclusao).toHaveValue('');
  });

  it('o erro da API aparece no editor, que continua aberto', async () => {
    const item = umItem({ titulo_original: 'Frieren' });
    const { user, dialogo } = await editar(item, {
      [`PUT /lista/${item.id_lista}`]: erro(400, 'dados_invalidos', 'Status inválido para o Tipo.'),
    });

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Status inválido para o Tipo.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('remover pede confirmação e tira o Item da Lista', async () => {
    const item = umItem({ titulo_original: 'Frieren' });
    const { user, dialogo, api } = await editar(item);

    await user.click(within(dialogo).getByRole('button', { name: 'Remover' }));
    expect(within(dialogo).getByText(/Remover esta Mídia da sua Lista\?/)).toBeInTheDocument();
    await user.click(within(dialogo).getByRole('button', { name: 'Remover da Lista' }));

    expect(api.para(`DELETE /lista/${item.id_lista}`)).toHaveLength(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('useEditorItem (Início e detalhe)', () => {
  function Abrir() {
    const { abrirEditor } = useEditorItem();
    const midia = umaMidia({ id_midia: 'MID-berserk', tipo: 'manga', titulo_original: 'Berserk', numero_capitulos: 380 });
    return (
      <button type="button" onClick={() => abrirEditor(midia, null)}>
        Adicionar Berserk
      </button>
    );
  }

  it('abre o editor vazio, no Planejado do Tipo, e adiciona com POST /lista/adicionar', async () => {
    const api = simularFetch({ ...rotasDaSessao(), 'POST /lista/adicionar': { status: 201, corpo: { mensagem: 'ok', id_lista: 'LST-novo' } } });
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={new QueryClient()}>
        <SessaoProvider>
          <EditorItemProvider>
            <Abrir />
          </EditorItemProvider>
        </SessaoProvider>
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Adicionar Berserk' }));
    const dialogo = screen.getByRole('dialog', { name: 'Berserk' });
    expect(within(dialogo).getByText('Adicionar à Lista · Mangá')).toBeInTheDocument();
    expect(within(dialogo).getByRole('radio', { name: 'Planejado' })).toBeChecked();
    expect(within(dialogo).getByLabelText('Capítulos (de 380)')).toHaveValue('0');
    expect(within(dialogo).queryByRole('button', { name: 'Remover' })).not.toBeInTheDocument();

    await user.click(within(dialogo).getByRole('button', { name: 'Salvar' }));

    expect(api.para('POST /lista/adicionar')[0]?.corpo).toMatchObject({ id_midia: 'MID-berserk', status_consumo: 'planejado', progresso_atual: 0 });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
