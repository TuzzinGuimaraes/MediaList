import { ActivityIndicator, Text, View } from 'react-native';

import { ErroRede, mensagemDeErro } from '../api/erros';
import { useCores } from '../tema/TemaContext';
import { Botao } from './Botao';
import { Monograma } from './Monograma';

export function Carregando() {
  const cores = useCores();
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-fundo">
      <Monograma tamanho={44} rotulo={null} />
      <ActivityIndicator color={cores['marca-texto']} accessibilityLabel="Carregando" />
    </View>
  );
}

export function Vazio({ mensagem }: { mensagem: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-fundo p-6">
      <Monograma tamanho={44} rotulo={null} />
      <Text className="text-center text-corpo text-texto-suave">{mensagem}</Text>
    </View>
  );
}

/** Erro numa parte da tela que não impede o resto de aparecer. */
export function FalhaParcial({ erro, tentarDeNovo }: { erro: unknown; tentarDeNovo: () => void }) {
  return (
    <View className="gap-2">
      <Text accessibilityRole="alert" className="text-corpo text-erro">
        {mensagemDeErro(erro)}
      </Text>
      <Botao titulo="Tentar de novo" variante="secundario" onPress={tentarDeNovo} />
    </View>
  );
}

/** Erro ou falta de conexão, sempre com "Tentar de novo". */
export function Falha({ erro, tentarDeNovo }: { erro: unknown; tentarDeNovo: () => void }) {
  const offline = erro instanceof ErroRede;
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-fundo p-6">
      <Text accessibilityRole="alert" className="text-center text-corpo text-texto-forte">
        {offline ? 'Sem conexão com o servidor.' : mensagemDeErro(erro)}
      </Text>
      {offline ? (
        <Text className="text-center text-corpo text-texto-suave">Verifique a internet e tente de novo.</Text>
      ) : null}
      <Botao titulo="Tentar de novo" variante="secundario" onPress={tentarDeNovo} />
    </View>
  );
}
