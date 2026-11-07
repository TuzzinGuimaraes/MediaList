import * as SecureStore from 'expo-secure-store';

import { carregarSessao, guardarSessao, guardarTokens } from './armazenamento';
import { usuarioAna } from '../testes/fetchSimulado';

describe('armazenamento da sessão', () => {
  it('se o app morre no meio da gravação do par novo, o refresh guardado não é o já rotacionado', async () => {
    await guardarSessao({ tokens: { access: 'A1', refresh: 'R1' }, usuario: usuarioAna as never });
    const gravar = SecureStore.setItemAsync;
    let gravacoes = 0;
    // O processo morre depois da primeira gravação: as seguintes nunca acontecem.
    jest.spyOn(SecureStore, 'setItemAsync').mockImplementation(async (chave, valor) => {
      gravacoes += 1;
      if (gravacoes > 1) throw new Error('app encerrado');
      return gravar(chave, valor);
    });

    await guardarTokens({ access: 'A2', refresh: 'R2' }).catch(() => undefined);

    const guardada = await carregarSessao();
    expect(guardada?.tokens.refresh).toBe('R2');
  });
});
