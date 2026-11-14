import { erro } from '../testes/contrato';
import { simularFetch } from '../testes/fetchSimulado';
import { criarCliente } from './cliente';
import { ErroApi } from './erros';

const semSessao = { atuais: () => null, renovados: async () => {}, expirada: async () => {} };
const cliente = criarCliente('http://api.teste/api', semSessao);

async function falha(promessa: Promise<unknown>): Promise<ErroApi> {
  try {
    await promessa;
  } catch (e) {
    if (e instanceof ErroApi) return e;
    throw e;
  }
  throw new Error('a requisição deveria ter falhado');
}

describe('erro da API', () => {
  it('lê o envelope {erro, codigo, detalhes}: a mensagem vai para a tela, o código para as decisões', async () => {
    simularFetch({
      'POST /auth/registro': erro(400, 'dados_invalidos', 'Dados inválidos', { email: 'Campo obrigatório' }),
    });

    const e = await falha(cliente.requisitar('/auth/registro', { metodo: 'POST', corpo: {} }));

    expect(e.status).toBe(400);
    expect(e.message).toBe('Dados inválidos');
    expect(e.codigo).toBe('dados_invalidos');
    expect(e.detalhes).toEqual({ email: 'Campo obrigatório' });
  });

  it('resposta sem envelope (proxy, HTML) fica sem código, com a mensagem genérica do status', async () => {
    simularFetch({ 'GET /midias': { status: 502 } });

    const e = await falha(cliente.requisitar('/midias'));

    expect(e.message).toBe('Erro 502');
    expect(e.codigo).toBeNull();
    expect(e.detalhes).toBeNull();
  });
});
