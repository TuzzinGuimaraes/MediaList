// A URL da API nos testes é fixa: a descoberta pelo host do Metro tem teste próprio.
process.env.EXPO_PUBLIC_API_URL = 'http://api.teste/api';

// expo-secure-store em memória: o cofre do aparelho não existe no Jest.
jest.mock('expo-secure-store', () => {
  const mockCofre = new Map<string, string>();
  return {
    getItemAsync: async (chave: string) => mockCofre.get(chave) ?? null,
    setItemAsync: async (chave: string, valor: string) => {
      mockCofre.set(chave, valor);
    },
    deleteItemAsync: async (chave: string) => {
      mockCofre.delete(chave);
    },
    __limpar: () => mockCofre.clear(),
  };
});

beforeEach(() => {
  require('expo-secure-store').__limpar();
});
