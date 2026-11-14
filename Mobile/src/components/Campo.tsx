import { Text, TextInput, type TextInputProps, View } from 'react-native';

import { usePaleta } from '../prototipo/PrototipoContext';

type Props = Omit<TextInputProps, 'className'> & { rotulo: string };

export function Campo({ rotulo, ...props }: Props) {
  const paleta = usePaleta();
  return (
    <View className="gap-1">
      <Text className="text-legenda text-text-secondary">{rotulo}</Text>
      <TextInput
        accessibilityLabel={rotulo}
        placeholderTextColor={paleta.text.secondary}
        className="rounded-md border border-dark-border bg-dark-tertiary px-3 py-3 text-campo text-text-bright"
        {...props}
      />
    </View>
  );
}
