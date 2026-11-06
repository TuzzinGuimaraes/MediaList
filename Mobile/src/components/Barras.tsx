import { Text, View } from 'react-native';

export type Barra = {
  rotulo: string;
  valor: number;
  /** Refinamento da barra anterior (ex.: Platinado dentro de Concluído): aparece recuada. */
  refinamento?: boolean;
};

/** Barras horizontais feitas com View, proporcionais ao maior valor do grupo. */
export function Barras({ titulo, barras }: { titulo: string; barras: Barra[] }) {
  const maximo = Math.max(1, ...barras.map((b) => b.valor));
  return (
    <View className="gap-3">
      <Text className="text-base font-semibold text-text-bright">{titulo}</Text>
      {barras.map((b) => (
        <View
          key={b.rotulo}
          accessible
          accessibilityLabel={`${b.rotulo}: ${b.valor}`}
          className={`gap-1 ${b.refinamento ? 'pl-4' : ''}`}
        >
          <View className="flex-row justify-between">
            <Text className="text-sm text-text-secondary">
              {b.refinamento ? `↳ ${b.rotulo}` : b.rotulo}
            </Text>
            <Text className="text-sm text-text-primary">{b.valor}</Text>
          </View>
          <View className="h-2 overflow-hidden rounded-full bg-dark-tertiary">
            <View
              className={`h-2 rounded-full ${b.refinamento ? 'bg-accent-yellow' : 'bg-accent-blue'}`}
              style={{ width: `${(b.valor / maximo) * 100}%` }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}
