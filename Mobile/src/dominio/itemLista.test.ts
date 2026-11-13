import {
  ajustarFormulario,
  aplicarProgresso,
  estadosDaLista,
  formularioDoItem,
  itensDoEstado,
  passoDeProgresso,
  rotuloInicial,
  temProgresso,
  totalDoItem,
  validarItem,
} from './itemLista';

const anime = { tipo: 'anime' as const, numero_episodios: 28, numero_capitulos: null };
const manga = { tipo: 'manga' as const, numero_episodios: null, numero_capitulos: 95 };
const jogo = { tipo: 'jogo' as const, numero_episodios: null, numero_capitulos: null };

describe('Progresso', () => {
  it('jogos não têm Progresso; anime e mangá têm', () => {
    expect(temProgresso('anime')).toBe(true);
    expect(temProgresso('manga')).toBe(true);
    expect(temProgresso('jogo')).toBe(false);
  });

  it('o total é o do Item, ou o da Mídia pelo Tipo; jogo não tem total', () => {
    expect(totalDoItem({ ...anime, progresso_total: 24 })).toBe(24);
    expect(totalDoItem({ ...anime, progresso_total: null })).toBe(28);
    expect(totalDoItem({ ...manga, progresso_total: null })).toBe(95);
    expect(totalDoItem({ ...manga, numero_capitulos: null, progresso_total: null })).toBeNull();
    expect(totalDoItem({ ...jogo, progresso_total: 40 })).toBeNull();
  });

  it('o passo não passa de 0 nem do total', () => {
    const item = { ...anime, progresso_total: 28 };
    expect(passoDeProgresso({ ...item, progresso_atual: 12 }, 1)).toBe(13);
    expect(passoDeProgresso({ ...item, progresso_atual: 12 }, -1)).toBe(11);
    expect(passoDeProgresso({ ...item, progresso_atual: 0 }, -1)).toBeNull();
    expect(passoDeProgresso({ ...item, progresso_atual: null }, -1)).toBeNull();
    expect(passoDeProgresso({ ...item, progresso_atual: null }, 1)).toBe(1);
    expect(passoDeProgresso({ ...item, progresso_atual: 28 }, 1)).toBeNull();
  });

  it('sem total conhecido, o + não tem teto', () => {
    const item = { ...manga, numero_capitulos: null, progresso_total: null, progresso_atual: 500 };
    expect(passoDeProgresso(item, 1)).toBe(501);
  });

  it('jogo não tem passo de Progresso', () => {
    expect(passoDeProgresso({ ...jogo, progresso_total: null, progresso_atual: 10 }, 1)).toBeNull();
  });
});

describe('aplicarProgresso (o que o backend fará, para o otimista)', () => {
  const base = {
    ...anime,
    progresso_total: 28,
    status_consumo: 'assistindo',
    data_conclusao: null as string | null,
  };
  const hoje = '2026-11-06';

  it('abaixo do total só muda o Progresso', () => {
    expect(aplicarProgresso({ ...base, progresso_atual: 12 }, 13, hoje)).toMatchObject({
      progresso_atual: 13,
      status_consumo: 'assistindo',
      data_conclusao: null,
    });
  });

  it('atingir o total leva a Concluído com o Rótulo do Tipo e a data de hoje', () => {
    expect(aplicarProgresso({ ...base, progresso_atual: 27 }, 28, hoje)).toMatchObject({
      progresso_atual: 28,
      status_consumo: 'completo',
      data_conclusao: hoje,
    });
    const mng = { ...manga, progresso_total: 95, status_consumo: 'lendo', data_conclusao: null, progresso_atual: 94 };
    expect(aplicarProgresso(mng, 95, hoje).status_consumo).toBe('lido');
  });

  it('reentrar em Concluído com data anterior renova a data e soma +1 na Recontagem', () => {
    const item = { ...base, progresso_atual: 27, status_consumo: 'pausado', data_conclusao: '2025-01-01', total_rewatches: 1 };
    expect(aplicarProgresso(item, 28, hoje)).toMatchObject({
      status_consumo: 'completo',
      data_conclusao: hoje,
      total_rewatches: 2,
    });
  });

  it('primeira conclusão não soma Recontagem', () => {
    const item = { ...base, progresso_atual: 27, total_rewatches: 0 };
    expect(aplicarProgresso(item, 28, hoje).total_rewatches).toBe(0);
  });

  it('baixar do total rebaixa ao Em progresso do Tipo e mantém a data de conclusão', () => {
    const item = { ...base, progresso_atual: 28, status_consumo: 'completo', data_conclusao: '2025-01-01' };
    expect(aplicarProgresso(item, 27, hoje)).toMatchObject({
      progresso_atual: 27,
      status_consumo: 'assistindo',
      data_conclusao: '2025-01-01',
    });
    const mng = { ...manga, progresso_total: 95, status_consumo: 'lido', data_conclusao: null, progresso_atual: 95 };
    expect(aplicarProgresso(mng, 61, hoje).status_consumo).toBe('lendo');
  });

  it('sem total conhecido, o Estado não segue o Progresso', () => {
    const mng = { ...manga, numero_capitulos: null, progresso_total: null, status_consumo: 'lido', data_conclusao: null, progresso_atual: 50 };
    expect(aplicarProgresso(mng, 49, hoje).status_consumo).toBe('lido');
  });
});

describe('formulário segue a regra de Concluído (ADR 0009)', () => {
  const midia = { tipo: 'anime' as const, total: 64 };
  const form = { ...formularioDoItem(null, 'anime'), status_consumo: 'assistindo', progresso: '61' };

  it('escolher Concluído leva o Progresso ao total', () => {
    expect(ajustarFormulario(form, { ...form, status_consumo: 'completo' }, midia)).toMatchObject({
      status_consumo: 'completo',
      progresso: '64',
    });
  });

  it('Progresso abaixo do total com Concluído volta a Em progresso; no total, volta a Concluído', () => {
    const concluido = { ...form, status_consumo: 'completo', progresso: '64' };
    const rebaixado = ajustarFormulario(concluido, { ...concluido, progresso: '6' }, midia);
    expect(rebaixado.status_consumo).toBe('assistindo');
    expect(ajustarFormulario(rebaixado, { ...rebaixado, progresso: '64' }, midia).status_consumo).toBe('completo');
  });

  it('sem total e jogo ficam como o Usuário escolheu (Platinado intacto)', () => {
    expect(ajustarFormulario(form, { ...form, status_consumo: 'completo' }, { tipo: 'manga', total: null }).progresso).toBe('61');
    const jogo = { ...formularioDoItem(null, 'jogo'), status_consumo: 'platinado', progresso: '40' };
    expect(ajustarFormulario(jogo, { ...jogo, progresso: '3' }, { tipo: 'jogo', total: null }).status_consumo).toBe('platinado');
  });
});

describe('Rótulos e abas', () => {
  it('Rótulo inicial ao adicionar é o Planejado do Tipo', () => {
    expect(rotuloInicial('anime')).toBe('planejado');
    expect(rotuloInicial('jogo')).toBe('na_fila');
  });

  it('as abas do Recorte só têm os estados que se aplicam aos Tipos dele', () => {
    expect(estadosDaLista(['anime', 'manga'])).toEqual([
      'em_progresso',
      'planejado',
      'pausado',
      'abandonado',
      'concluido',
    ]);
    expect(estadosDaLista(['jogo'])).toContain('platinado');
  });

  it('a aba Concluído inclui os platinados (Platinado ⊂ Concluído)', () => {
    const itens = [
      { tipo: 'jogo' as const, status_consumo: 'zerado' },
      { tipo: 'jogo' as const, status_consumo: 'platinado' },
      { tipo: 'jogo' as const, status_consumo: 'jogando' },
    ];
    expect(itensDoEstado(itens, 'concluido').map((i) => i.status_consumo)).toEqual(['zerado', 'platinado']);
    expect(itensDoEstado(itens, 'platinado').map((i) => i.status_consumo)).toEqual(['platinado']);
  });
});

describe('formulário do editor', () => {
  const item = {
    ...anime,
    status_consumo: 'assistindo',
    progresso_atual: 12,
    progresso_total: 28,
    nota_usuario: '8.50',
    favorito: 1,
    privado: 0,
    data_inicio: '2026-10-01',
    data_conclusao: null,
    total_rewatches: 1,
    comentario: 'Reassistindo',
  };

  it('preenche a partir do Item como veio da API', () => {
    expect(formularioDoItem(item, 'anime')).toEqual({
      status_consumo: 'assistindo',
      progresso: '12',
      nota: '8.5',
      favorito: true,
      privado: false,
      inicio: '01/10/2026',
      conclusao: '',
      recontagem: '1',
      comentario: 'Reassistindo',
    });
  });

  it('sem Item, começa Planejado e zerado', () => {
    expect(formularioDoItem(null, 'jogo')).toMatchObject({
      status_consumo: 'na_fila',
      progresso: '0',
      nota: '',
      favorito: false,
      recontagem: '0',
    });
  });

  const valido = formularioDoItem(item, 'anime');

  it('converte para o corpo da API', () => {
    expect(validarItem({ ...valido, nota: '9,5', comentario: '  ' }, { tipo: 'anime', total: 28 })).toEqual({
      ok: true,
      dados: {
        status_consumo: 'assistindo',
        progresso_atual: 12,
        nota_usuario: 9.5,
        favorito: true,
        privado: false,
        data_inicio: '2026-10-01',
        data_conclusao: null,
        total_rewatches: 1,
        comentario: null,
      },
    });
    expect(validarItem({ ...valido, nota: '' }, { tipo: 'anime', total: 28 })).toMatchObject({
      ok: true,
      dados: { nota_usuario: null },
    });
  });

  it.each([
    [{ status_consumo: 'platinado' }, 'Escolha um Estado de consumo válido para o Tipo.'],
    [{ progresso: '29' }, 'O Progresso vai de 0 a 28.'],
    [{ progresso: '-1' }, 'O Progresso vai de 0 a 28.'],
    [{ progresso: '1.5' }, 'O Progresso vai de 0 a 28.'],
    [{ nota: '10' }, 'A Nota pessoal vai de 0 a 9,99.'],
    [{ nota: 'abc' }, 'A Nota pessoal vai de 0 a 9,99.'],
    [{ recontagem: '-2' }, 'A Recontagem é um número inteiro a partir de 0.'],
    [{ inicio: '31/02/2026' }, 'Data de início inválida (dd/mm/aaaa).'],
    [{ conclusao: '2026-10-01' }, 'Data de conclusão inválida (dd/mm/aaaa).'],
    [{ inicio: '10/10/2026', conclusao: '09/10/2026' }, 'A conclusão não pode ser antes do início.'],
  ])('recusa %o', (mudanca, erro) => {
    expect(validarItem({ ...valido, ...mudanca }, { tipo: 'anime', total: 28 })).toEqual({ ok: false, erro });
  });

  it('jogo aceita horas sem teto e Platinado', () => {
    const f = { ...formularioDoItem(null, 'jogo'), status_consumo: 'platinado', progresso: '320' };
    expect(validarItem(f, { tipo: 'jogo', total: null })).toMatchObject({
      ok: true,
      dados: { status_consumo: 'platinado', progresso_atual: 320 },
    });
  });

  it('vazio no Progresso conta como 0', () => {
    expect(validarItem({ ...valido, progresso: '' }, { tipo: 'anime', total: 28 })).toMatchObject({
      ok: true,
      dados: { progresso_atual: 0 },
    });
  });
});
