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

// Páginas deslizáveis da Lista: o componente nativo não existe no Jest.
jest.mock('react-native-pager-view', () => require('./src/testes/pagerSimulado'));


// expo-updates de mentira: por padrão desligado, como no dev e no Expo Go. O teste do Perfil
// liga com `__definir` para simular um APK (embutido, com update em execução ou com update pendente).
jest.mock('expo-updates', () => {
  const desligado = {
    ativo: false,
    updateId: undefined as string | undefined,
    isEmbeddedLaunch: false,
    isUpdatePending: false,
  };
  let mockEstado = { ...desligado };
  return {
    get isEnabled() {
      return mockEstado.ativo;
    },
    useUpdates: () => ({
      currentlyRunning: { updateId: mockEstado.updateId, isEmbeddedLaunch: mockEstado.isEmbeddedLaunch },
      isUpdatePending: mockEstado.isUpdatePending,
      isUpdateAvailable: mockEstado.isUpdatePending,
    }),
    reloadAsync: jest.fn(async () => {}),
    __definir: (estado: Partial<typeof desligado>) => {
      mockEstado = { ...desligado, ...estado };
    },
    __limpar: () => {
      mockEstado = { ...desligado };
    },
  };
});

beforeEach(() => {
  require('expo-updates').__limpar();
});
