// PROTÓTIPO (ticket 29): dublê mínimo do Reanimated 4 para o Jest. O mock oficial
// (react-native-reanimated/mock) quebra sob o Jest; o expo-router/testing-library o
// carrega, e o package.json redireciona esse caminho para cá. Nos testes o "reduzir
// movimento" está ligado, então nada anima.
const { View, ScrollView, FlatList } = require('react-native');

const entrada = {};
entrada.delay = () => entrada;
entrada.duration = () => entrada;

module.exports = {
  __esModule: true,
  default: { View, ScrollView, FlatList, createAnimatedComponent: (c) => c },
  useSharedValue: (inicial) => {
    const v = { value: inicial, get: () => v.value, set: (n) => (v.value = n) };
    return v;
  },
  useAnimatedStyle: () => ({}),
  useAnimatedScrollHandler: () => () => {},
  interpolate: () => 0,
  Extrapolation: { CLAMP: 'clamp' },
  withTiming: (v) => v,
  runOnJS: (f) => f,
  Easing: { bezier: () => (t) => t },
  FadeIn: entrada,
  FadeInDown: entrada,
  FadeInRight: entrada,
};
