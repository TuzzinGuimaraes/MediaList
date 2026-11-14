import { Pressable, ScrollView, Text } from 'react-native';

type Props<V> = {
  rotulo: string;
  opcoes: { valor: V; titulo: string }[];
  valor: V;
  escolher(valor: V): void;
};

/** Uma escolha entre poucas opções, em fila rolável de chips. */
export function Opcoes<V>({ rotulo, opcoes, valor, escolher }: Props<V>) {
  return (
    <ScrollView
      horizontal
      accessibilityLabel={rotulo}
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerClassName="gap-2 px-4"
    >
      {opcoes.map((opcao) => {
        const ativo = opcao.valor === valor;
        return (
          <Pressable
            key={opcao.titulo}
            accessibilityRole="button"
            accessibilityLabel={opcao.titulo}
            accessibilityState={{ selected: ativo }}
            onPress={() => escolher(opcao.valor)}
            className={`rounded-full border px-3 py-1.5 ${
              ativo ? 'border-marca-texto bg-superficie-alta' : 'border-borda bg-superficie'
            }`}
          >
            <Text className={`text-corpo font-semibold ${ativo ? 'text-marca-texto' : 'text-texto-suave'}`}>
              {opcao.titulo}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
