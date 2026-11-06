// Variação "tela cheia" do editor do Item de lista.
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView } from 'react-native';

import { est } from '@/proto/componentes';
import { EditorForm } from '@/proto/editor';

export default function EditorTela() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <ScrollView style={est.tela} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <EditorForm idMidia={Number(id)} onFechar={() => (router.canGoBack() ? router.back() : router.replace('/lista'))} />
    </ScrollView>
  );
}
