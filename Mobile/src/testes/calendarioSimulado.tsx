import { View } from 'react-native';

/** Fica no lugar de `@react-native-community/datetimepicker` nos testes (ver jest.setup.ts). */
export default function CalendarioSimulado(props: object) {
  return <View testID="calendario" {...props} />;
}
