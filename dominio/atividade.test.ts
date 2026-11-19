import { montarMapa, nivelDeAtividade } from './atividade';

describe('nivelDeAtividade (faixas de intensidade do mapa)', () => {
  it('dia sem atividade fica no vazio', () => {
    expect(nivelDeAtividade(0, 10)).toBe(0);
  });

  it('divide o maior dia em quatro faixas iguais', () => {
    // Até 25% do maior dia: 1; até 50%: 2; até 75%: 3; acima: 4.
    expect([1, 2, 3, 5, 6, 7, 8, 10].map((t) => nivelDeAtividade(t, 10))).toEqual([1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it('com um único dia de atividade, ele é o mais intenso', () => {
    expect(nivelDeAtividade(1, 1)).toBe(4);
  });
});

describe('montarMapa', () => {
  // 2026-11-19 é uma quinta-feira; a janela da API começa 363 dias antes.
  const resposta = {
    inicio: '2025-11-21',
    fim: '2026-11-19',
    dias: [
      { data: '2025-11-21', total: 9 },
      { data: '2025-11-23', total: 1 },
      { data: '2026-11-19', total: 4 },
    ],
  };

  it('tem 52 semanas de 7 dias, de domingo a sábado, terminando na semana de hoje', () => {
    const mapa = montarMapa(resposta);

    expect(mapa.semanas).toHaveLength(52);
    expect(mapa.semanas.every((s) => s.length === 7)).toBe(true);
    expect(mapa.semanas[0]?.[0]?.data).toBe('2025-11-23');
    expect(mapa.semanas[51]?.[4]).toMatchObject({ data: '2026-11-19', total: 4 });
    // Sexta e sábado depois de hoje ficam em branco.
    expect(mapa.semanas[51]?.slice(5)).toEqual([null, null]);
  });

  it('dias sem registro valem zero, e o total soma a janela inteira', () => {
    const mapa = montarMapa(resposta);

    expect(mapa.semanas[0]?.[1]).toEqual({ data: '2025-11-24', total: 0, nivel: 0 });
    expect(mapa.total).toBe(14);
  });

  it('a intensidade é relativa ao maior dia da grade', () => {
    const mapa = montarMapa(resposta);

    expect(mapa.semanas[0]?.[0]?.nivel).toBe(1); // 1 de 4
    expect(mapa.semanas[51]?.[4]?.nivel).toBe(4);
  });

  it('marca o mês na coluna em que ele começa', () => {
    const mapa = montarMapa(resposta);

    // 1º de dezembro de 2025 cai na 2ª semana; 1º de novembro de 2026, na 50ª.
    expect(mapa.meses).toContainEqual({ coluna: 1, nome: 'dez' });
    expect(mapa.meses).toContainEqual({ coluna: 49, nome: 'nov' });
    expect(mapa.meses.map((m) => m.nome).slice(0, 3)).toEqual(['dez', 'jan', 'fev']);
  });
});
