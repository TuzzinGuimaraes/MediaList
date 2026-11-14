// Dublê mínimo do Reanimated 4 para o Jest. O mock oficial (react-native-reanimated/mock)
// quebra sob o Jest e o expo-router/testing-library cai num objeto vazio; o package.json
// redireciona esse caminho para cá. Nos testes o "reduzir movimento" está ligado, então nada anima.
const { View, ScrollView, FlatList } = require('react-native');

module.exports = {
  __esModule: true,
  default: { View, ScrollView, FlatList, createAnimatedComponent: (c) => c },
  useSharedValue: (inicial) => {
    const v = { value: inicial, get: () => v.value, set: (n) => (v.value = n) };
    return v;
  },
  useAnimatedStyle: () => ({}),
  useAnimatedScrollHandler: () => () => {},
};
