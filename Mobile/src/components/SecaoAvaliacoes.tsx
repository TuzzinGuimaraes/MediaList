import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Text, View } from 'react-native';

import type { AvaliacaoCompleta } from '../api/tipos';
import { useSessao } from '../auth/SessaoContext';
import { formatarData } from '../dominio/midia';
import paleta from '../tema/paleta';
import { Botao } from './Botao';
import { FormularioAvaliacao } from './FormularioAvaliacao';

const textos = {
  titulo: 'Avaliações',
  nenhuma: 'Nenhuma Avaliação ainda.',
  escrever: 'Escrever Avaliação',
};

function ItemAvaliacao({ a }: { a: AvaliacaoCompleta }) {
  return (
    <View accessibilityLabel={`Avaliação de ${a.nome_completo}`} className="gap-1 rounded-md bg-dark-tertiary p-3">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 text-sm font-semibold text-text-bright">{a.nome_completo}</Text>
        <View className="flex-row items-center gap-1">
          <Ionicons name="star" size={12} color={paleta.accent.yellow} />
          <Text className="text-sm font-bold text-accent-yellow">{String(Number(a.nota))}</Text>
        </View>
      </View>
      <Text className="text-xs text-text-secondary">{formatarData(a.data_avaliacao)}</Text>
      {a.titulo_avaliacao ? (
        <Text className="text-sm font-semibold text-text-bright">{a.titulo_avaliacao}</Text>
      ) : null}
      {a.texto_avaliacao ? <Text className="text-sm leading-5 text-text-primary">{a.texto_avaliacao}</Text> : null}
    </View>
  );
}

export function SecaoAvaliacoes({ idMidia, avaliacoes }: { idMidia: string; avaliacoes: AvaliacaoCompleta[] }) {
  const { sessao } = useSessao();
  const [formulario, setFormulario] = useState(false);
  const idUsuario = sessao.estado === 'autenticada' ? sessao.usuario.id : null;
  const minha = avaliacoes.find((a) => a.id_usuario === idUsuario);

  return (
    <View className="gap-3 rounded-md bg-dark-secondary p-4">
      <Text className="text-xs font-bold uppercase tracking-wider text-text-secondary">{textos.titulo}</Text>
      {!minha ? <Botao titulo={textos.escrever} onPress={() => setFormulario(true)} /> : null}
      {avaliacoes.length ? (
        avaliacoes.map((a) => <ItemAvaliacao key={a.id_avaliacao} a={a} />)
      ) : (
        <Text className="text-sm text-text-secondary">{textos.nenhuma}</Text>
      )}
      {formulario ? <FormularioAvaliacao idMidia={idMidia} aoFechar={() => setFormulario(false)} /> : null}
    </View>
  );
}
