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


// "Reduzir movimento" ligado: a troca de Recorte e o menu ficam instantâneos e os testes não esperam animação.
// O teste da transição animada desliga de volta.
beforeEach(() => {
  const { AccessibilityInfo } = require('react-native');
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
});


// Calendário nativo de mentira: um View com as props do picker; o teste chama `onChange` como o
// diálogo do Android faria ao escolher ("set") ou cancelar ("dismissed").
jest.mock('@react-native-community/datetimepicker', () => require('./src/testes/calendarioSimulado'));
