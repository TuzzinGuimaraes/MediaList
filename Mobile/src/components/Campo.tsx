import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { type Ref, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, Text, TextInput, type TextInputInstance, type TextInputProps, View } from 'react-native';

import { useCores } from '../tema/TemaContext';

type Props = Omit<TextInputProps, 'className'> & { rotulo: string; ref?: Ref<TextInputInstance> };

const ESTILO = 'rounded-md border border-borda bg-superficie-alta px-3 py-3 text-campo text-texto-forte';

export function Campo({ rotulo, ref, ...props }: Props) {
  const cores = useCores();
  return (
    <View className="gap-1">
      <Text className="text-legenda text-texto-suave">{rotulo}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={rotulo}
        placeholderTextColor={cores['texto-suave']}
        className={ESTILO}
        {...props}
      />
    </View>
  );
}

/** O que a tela faz com um CampoSenha: focar (o "next" do campo anterior) e ocultar (ao enviar). */
export type CampoSenhaRef = { focus: () => void; ocultar: () => void };

type PropsSenha = Omit<Props, 'ref' | 'secureTextEntry'> & { ref?: Ref<CampoSenhaRef> };

/**
 * Campo de senha com o olho de mostrar/ocultar à direita (alvo de 44 px). Começa oculta e volta
 * a ocultar ao sair da tela; ao enviar, a tela chama `ocultar()`. Sem animação.
 */
export function CampoSenha({ rotulo, ref, ...props }: PropsSenha) {
  const cores = useCores();
  const [visivel, setVisivel] = useState(false);
  const entrada = useRef<TextInputInstance>(null);
  useImperativeHandle(ref, () => ({ focus: () => entrada.current?.focus(), ocultar: () => setVisivel(false) }), []);
  useFocusEffect(useCallback(() => () => setVisivel(false), []));
  const acao = visivel ? 'Ocultar senha' : 'Mostrar senha';
  return (
    <View className="gap-1">
      <Text className="text-legenda text-texto-suave">{rotulo}</Text>
      <View className="justify-center">
        <TextInput
          ref={entrada}
          accessibilityLabel={rotulo}
          placeholderTextColor={cores['texto-suave']}
          className={`${ESTILO} pr-12`}
          autoCapitalize="none"
          autoCorrect={false}
          {...props}
          secureTextEntry={!visivel}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={acao}
          accessibilityState={{ selected: visivel }}
          onPress={() => setVisivel((v) => !v)}
          className="absolute right-0 h-11 w-11 items-center justify-center"
        >
          <Ionicons name={visivel ? 'eye-off-outline' : 'eye-outline'} size={20} color={cores['texto-suave']} />
        </Pressable>
      </View>
    </View>
  );
}
