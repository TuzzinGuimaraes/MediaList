import { Text, TextInput, type TextInputProps, View } from 'react-native';

import { useCores } from '../tema/TemaContext';

type Props = Omit<TextInputProps, 'className'> & { rotulo: string };

export function Campo({ rotulo, ...props }: Props) {
  const cores = useCores();
  return (
    <View className="gap-1">
      <Text className="text-legenda text-texto-suave">{rotulo}</Text>
      <TextInput
        accessibilityLabel={rotulo}
        placeholderTextColor={cores['texto-suave']}
        className="rounded-md border border-borda bg-superficie-alta px-3 py-3 text-campo text-texto-forte"
        {...props}
      />
    </View>
  );
}
