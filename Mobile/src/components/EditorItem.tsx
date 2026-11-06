import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, Text, TextInput, type TextInputProps, View } from 'react-native';

import { mensagemDeErro } from '../api/erros';
import { useRemoverItem, useSalvarItem } from '../api/lista';
import type { ItemLista, Midia } from '../api/tipos';
import { estadoDe, NOMES_ESTADO, rotulosDoTipo } from '../dominio/estadoConsumo';
import {
  type FormularioItem,
  formularioDoItem,
  nomeDoProgresso,
  temProgresso,
  totalDoItem,
  validarItem,
} from '../dominio/itemLista';
import { tituloDaMidia } from '../dominio/midia';
import paleta from '../tema/paleta';
import { BottomSheet } from './BottomSheet';
import { Botao } from './Botao';

const textos = {
  editor: 'Editor do Item de lista',
  adicionar: 'Adicionar à Lista',
  editar: 'Editar Item da Lista',
  estado: 'Estado de consumo',
  nota: 'Nota pessoal',
  recontagem: 'Recontagem',
  inicio: 'Início',
  conclusao: 'Conclusão',
  data: 'dd/mm/aaaa',
  comentario: 'Comentário',
  favorito: 'Favorito',
  privado: 'Privado',
  salvar: 'Salvar',
  remover: 'Remover',
  confirmacao: 'Remover esta Mídia da sua Lista? Progresso, Nota pessoal e datas serão perdidos.',
  confirmar: 'Remover da Lista',
  manter: 'Manter',
};

type Props = {
  midia: Midia;
  /** Ausente ao adicionar. */
  item: ItemLista | null;
  aoFechar: () => void;
};

function CampoCurto({ rotulo, ...props }: Omit<TextInputProps, 'className'> & { rotulo: string }) {
  return (
    // Rótulo em até duas linhas, alinhado por baixo: os campos lado a lado ficam na mesma altura.
    <View className="flex-1 justify-end gap-1">
      <Text numberOfLines={2} className="text-legenda text-text-secondary">
        {rotulo}
      </Text>
      <TextInput
        accessibilityLabel={rotulo}
        placeholderTextColor={paleta.text.secondary}
        className="rounded-md border border-dark-border bg-dark-tertiary px-3 py-2 text-campo text-text-bright"
        {...props}
      />
    </View>
  );
}

function Alternar({ rotulo, icone, ativo, mudar }: { rotulo: string; icone: 'heart' | 'lock-closed'; ativo: boolean; mudar(): void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={rotulo}
      accessibilityState={{ checked: ativo }}
      onPress={mudar}
      hitSlop={6}
      className={`flex-row items-center gap-1 rounded-full border px-3 py-1.5 ${
        ativo ? 'border-accent-blue bg-dark-tertiary' : 'border-dark-border'
      }`}
    >
      <Ionicons
        name={ativo ? icone : (`${icone}-outline` as const)}
        size={16}
        color={ativo ? (icone === 'heart' ? paleta.accent.red : paleta.accent.blue) : paleta.text.secondary}
      />
      <Text className={`text-corpo font-semibold ${ativo ? 'text-text-bright' : 'text-text-secondary'}`}>{rotulo}</Text>
    </Pressable>
  );
}

/** Editor do Item de lista em bottom sheet. Montado só enquanto está aberto. */
export function EditorItem({ midia, item, aoFechar }: Props) {
  const tipo = midia.tipo;
  const total = totalDoItem(item ?? { ...midia, progresso_total: null });
  const [form, setForm] = useState<FormularioItem>(() => formularioDoItem(item, tipo));
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const salvar = useSalvarItem();
  const remover = useRemoverItem();

  const mudar = <K extends keyof FormularioItem>(campo: K) => (valor: FormularioItem[K]) =>
    setForm((f) => ({ ...f, [campo]: valor }));

  const enviar = async () => {
    const resultado = validarItem(form, { tipo, total });
    if (!resultado.ok) return setErro(resultado.erro);
    setErro(null);
    try {
      await salvar.mutateAsync({ idMidia: midia.id_midia, idLista: item?.id_lista, dados: resultado.dados });
      aoFechar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  };

  const confirmarRemocao = async () => {
    if (!item) return;
    setErro(null);
    try {
      await remover.mutateAsync({ idMidia: midia.id_midia, idLista: item.id_lista });
      aoFechar();
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  };

  const rotuloProgresso = temProgresso(tipo) && total !== null ? `${nomeDoProgresso(tipo)} (de ${total})` : nomeDoProgresso(tipo);

  return (
    <BottomSheet
      rotulo={textos.editor}
      aoFechar={aoFechar}
      cabecalho={
        <View className="gap-0.5">
          <Text className="text-legenda text-text-secondary">{item ? textos.editar : textos.adicionar}</Text>
          <Text accessibilityRole="header" numberOfLines={2} className="text-titulo-secao font-bold text-text-bright">
            {tituloDaMidia(midia)}
          </Text>
        </View>
      }
      rodape={
        <>
          {erro ? (
            <Text accessibilityRole="alert" className="text-corpo text-accent-red">
              {erro}
            </Text>
          ) : null}
          {confirmando ? (
            <>
              <Text className="text-corpo text-text-bright">{textos.confirmacao}</Text>
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Botao titulo={textos.manter} variante="secundario" onPress={() => setConfirmando(false)} />
                </View>
                <View className="flex-1">
                  <Botao titulo={textos.confirmar} onPress={confirmarRemocao} carregando={remover.isPending} />
                </View>
              </View>
            </>
          ) : (
            <View className="flex-row gap-2">
              {item ? (
                <View className="flex-1">
                  <Botao titulo={textos.remover} variante="secundario" onPress={() => setConfirmando(true)} />
                </View>
              ) : null}
              <View className="flex-[2]">
                <Botao titulo={textos.salvar} onPress={enviar} carregando={salvar.isPending} />
              </View>
            </View>
          )}
        </>
      }
    >
      <View className="gap-1.5">
        <Text className="text-legenda text-text-secondary">{textos.estado}</Text>
        {/* Só os Rótulos válidos para o Tipo: o backend recusa os outros (ADR 0002). */}
        <View accessibilityLabel={textos.estado} className="flex-row flex-wrap gap-2">
          {rotulosDoTipo(tipo).map((rotulo) => {
            const estado = estadoDe(rotulo, tipo);
            const ativo = form.status_consumo === rotulo;
            const nome = estado ? NOMES_ESTADO[estado] : rotulo;
            return (
              <Pressable
                key={rotulo}
                accessibilityRole="radio"
                accessibilityLabel={nome}
                accessibilityState={{ checked: ativo }}
                onPress={() => mudar('status_consumo')(rotulo)}
                className={`min-h-[40px] justify-center rounded-full border px-3 py-1.5 ${
                  ativo ? 'border-accent-blue bg-dark-tertiary' : 'border-dark-border'
                }`}
              >
                <Text className={`text-corpo font-semibold ${ativo ? 'text-accent-blue' : 'text-text-secondary'}`}>
                  {nome}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="flex-row gap-2">
        <CampoCurto
          rotulo={rotuloProgresso}
          value={form.progresso}
          onChangeText={mudar('progresso')}
          keyboardType="number-pad"
        />
        <CampoCurto rotulo={textos.nota} value={form.nota} onChangeText={mudar('nota')} keyboardType="decimal-pad" placeholder="0 a 9,99" />
        <CampoCurto rotulo={textos.recontagem} value={form.recontagem} onChangeText={mudar('recontagem')} keyboardType="number-pad" />
      </View>

      <View className="flex-row gap-2">
        <CampoCurto rotulo={textos.inicio} value={form.inicio} onChangeText={mudar('inicio')} placeholder={textos.data} keyboardType="numbers-and-punctuation" maxLength={10} />
        <CampoCurto rotulo={textos.conclusao} value={form.conclusao} onChangeText={mudar('conclusao')} placeholder={textos.data} keyboardType="numbers-and-punctuation" maxLength={10} />
      </View>

      <View className="flex-row gap-2">
        <Alternar rotulo={textos.favorito} icone="heart" ativo={form.favorito} mudar={() => mudar('favorito')(!form.favorito)} />
        <Alternar rotulo={textos.privado} icone="lock-closed" ativo={form.privado} mudar={() => mudar('privado')(!form.privado)} />
      </View>

      <View className="flex-row">
        <CampoCurto
          rotulo={textos.comentario}
          value={form.comentario}
          onChangeText={mudar('comentario')}
          multiline
          textAlignVertical="top"
          style={{ minHeight: 80 }}
        />
      </View>
    </BottomSheet>
  );
}
