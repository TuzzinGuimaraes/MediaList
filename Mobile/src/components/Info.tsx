import { Text, View } from 'react-native';

/** Rótulo pequeno e valor abaixo, lidos juntos pelo leitor de tela ("Lançamento: 29/09/2023"). */
export function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View accessible accessibilityLabel={`${rotulo}: ${valor}`} className="gap-0.5">
      <Text className="text-legenda text-texto-suave">{rotulo}</Text>
      <Text className="text-corpo text-texto-forte">{valor}</Text>
    </View>
  );
}
