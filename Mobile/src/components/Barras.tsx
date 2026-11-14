import { Text, View } from 'react-native';

type PropsTrilho = { proporcao: number; destaque?: boolean };

/** Trilho com o preenchimento proporcional (0 a 1). */
function Trilho({ proporcao, destaque = false }: PropsTrilho) {
  return (
    <View className="h-2 flex-1 overflow-hidden rounded-full bg-superficie-alta">
      <View
        className={`h-full rounded-full ${destaque ? 'bg-status-platinado' : 'bg-marca'}`}
        style={{ width: `${proporcao * 100}%` }}
      />
    </View>
  );
}

type PropsBarra = { rotulo: string; total: number; maximo: number; a11y: string };

/** Uma barra em linha: rótulo, trilho e o total, lidos juntos pelo `a11y`. */
export function Barra({ rotulo, total, maximo, a11y }: PropsBarra) {
  return (
    <View accessible accessibilityLabel={a11y} className="flex-row items-center gap-2">
      <Text className="w-28 text-legenda text-texto">{rotulo}</Text>
      <Trilho proporcao={maximo ? total / maximo : 0} />
      <Text className="w-9 text-right text-legenda text-texto-suave">{total}</Text>
    </View>
  );
}

export type ItemBarras = {
  rotulo: string;
  valor: number;
  /** Refinamento da barra anterior (ex.: Platinado dentro de Concluído): aparece recuada. */
  refinamento?: boolean;
};

/** Grupo de barras com título, proporcionais ao maior valor do grupo. */
export function Barras({ titulo, barras }: { titulo: string; barras: ItemBarras[] }) {
  const maximo = Math.max(1, ...barras.map((b) => b.valor));
  return (
    <View className="gap-3">
      <Text className="text-titulo-secao font-semibold text-texto-forte">{titulo}</Text>
      {barras.map((b) => (
        <View
          key={b.rotulo}
          accessible
          accessibilityLabel={`${b.rotulo}: ${b.valor}`}
          className={`gap-1 ${b.refinamento ? 'pl-4' : ''}`}
        >
          <View className="flex-row justify-between gap-3">
            <Text className="flex-1 text-corpo text-texto-suave">{b.refinamento ? `↳ ${b.rotulo}` : b.rotulo}</Text>
            <Text className="text-corpo text-texto">{b.valor}</Text>
          </View>
          <View className="flex-row">
            <Trilho proporcao={b.valor / maximo} destaque={b.refinamento} />
          </View>
        </View>
      ))}
    </View>
  );
}
