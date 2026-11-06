import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from 'react-native';

import { useSalvarAvaliacao } from '../api/avaliacoes';
import { mensagemDeErro } from '../api/erros';
import { type FormularioAvaliacao as Campos, validarAvaliacao } from '../dominio/avaliacao';
import { Botao } from './Botao';
import { Campo } from './Campo';

const textos = {
  nova: 'Escrever Avaliação',
  edicao: 'Editar Avaliação',
  aviso:
    'Sua Avaliação é pública: aparece para todos e entra na Nota média da Mídia. ' +
    'Ela é separada da Nota pessoal da sua Lista, e as duas podem ser diferentes.',
  nota: 'Nota (0,01 a 9,99)',
  titulo: 'Título',
  texto: 'Texto',
  publicar: 'Publicar',
  salvar: 'Salvar',
  cancelar: 'Cancelar',
};

type Props = {
  idMidia: string;
  /** Presente ao editar: a Avaliação existente e os campos dela. */
  edicao?: { idAvaliacao: string; campos: Campos };
  aoFechar: () => void;
};

/** Modal de criar ou editar a Avaliação do Usuário. Montado só enquanto está aberto. */
export function FormularioAvaliacao({ idMidia, edicao, aoFechar }: Props) {
  const [campos, setCampos] = useState<Campos>(edicao?.campos ?? { nota: '', titulo: '', texto: '' });
  const [erro, setErro] = useState<string | null>(null);
  const salvar = useSalvarAvaliacao(idMidia);

  const mudar = (campo: keyof Campos) => (valor: string) => setCampos((c) => ({ ...c, [campo]: valor }));

  const enviar = async () => {
    const resultado = validarAvaliacao(campos);
    if (!resultado.ok) return setErro(resultado.erro);
    setErro(null);
    try {
      await salvar.mutateAsync({ idAvaliacao: edicao?.idAvaliacao, dados: resultado.dados });
      aoFechar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={aoFechar}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end bg-black/60">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          className="max-h-[90%] rounded-t-xl bg-dark-secondary"
          contentContainerClassName="gap-4 p-5 pb-10"
        >
          <Text accessibilityRole="header" className="text-lg font-bold text-text-bright">
            {edicao ? textos.edicao : textos.nova}
          </Text>
          <Text className="text-sm leading-5 text-text-secondary">{textos.aviso}</Text>
          <Campo rotulo={textos.nota} value={campos.nota} onChangeText={mudar('nota')} keyboardType="decimal-pad" />
          <Campo rotulo={textos.titulo} value={campos.titulo} onChangeText={mudar('titulo')} maxLength={200} />
          <Campo
            rotulo={textos.texto}
            value={campos.texto}
            onChangeText={mudar('texto')}
            multiline
            textAlignVertical="top"
            style={{ minHeight: 120 }}
          />
          {erro ? (
            <Text accessibilityRole="alert" className="text-sm text-accent-red">
              {erro}
            </Text>
          ) : null}
          <View className="gap-2">
            <Botao titulo={edicao ? textos.salvar : textos.publicar} onPress={enviar} carregando={salvar.isPending} />
            <Botao titulo={textos.cancelar} variante="secundario" onPress={aoFechar} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
