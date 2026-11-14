import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Keyboard, Platform, Pressable, Text, TextInput, type TextInputProps, View } from 'react-native';

import { mensagemDeErro } from '../api/erros';
import { useRemoverItem, useSalvarItem } from '../api/lista';
import type { ItemLista, Midia } from '../api/tipos';
import { dataDoTexto, textoDaData } from '../dominio/datas';
import { estadoDe, NOMES_ESTADO, rotulosDoTipo, type TipoMidia } from '../dominio/estadoConsumo';
import {
  type EdicaoItem,
  type FormularioItem,
  iniciarEdicao,
  mudarEdicao,
  nomeDoProgresso,
  temProgresso,
  totalDoItem,
  validarItem,
} from '../dominio/itemLista';
import { tituloDaMidia } from '../dominio/midia';
import { usePaleta, useVibrar } from '../prototipo/PrototipoContext';
import { corDoEstado } from '../prototipo/PrototipoSelos';
import { BottomSheet } from './BottomSheet';
import { Botao } from './Botao';

const textos = {
  editor: 'Editor do Item de lista',
  adicionar: 'Adicionar à Lista',
  editar: 'Editar Item da Lista',
  // PROTÓTIPO (ticket 29): nomes só na tela; o código segue com Estado de consumo e Recontagem.
  estado: 'Status',
  nota: 'Nota pessoal',
  inicio: 'Início',
  conclusao: 'Conclusão',
  data: 'dd/mm/aaaa',
  semData: 'sem data',
  abreCalendario: 'Abre o calendário',
  limpar: 'Limpar',
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

/** Recontagem na tela: "Reassistido N×" / "Relido N×" / "Rejogado N×". */
const NOME_RECONTAGEM: Record<TipoMidia, string> = { anime: 'Reassistido', manga: 'Relido', jogo: 'Rejogado' };

function CampoCurto({ rotulo, ...props }: Omit<TextInputProps, 'className'> & { rotulo: string }) {
  const paleta = usePaleta();
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

type PropsData = { rotulo: string; valor: string; minimo?: Date; mudar(texto: string): void };

/** Data pelo calendário nativo (diálogo no Android), nunca no futuro; vazio = sem data. */
function CampoData({ rotulo, valor, minimo, mudar }: PropsData) {
  const [aberto, setAberto] = useState(false);
  const hoje = new Date();
  const escolher = (evento: DateTimePickerEvent, data?: Date) => {
    setAberto(false);
    if (evento.type === 'set' && data) mudar(textoDaData(data));
  };
  return (
    <View className="flex-1 justify-end gap-1">
      <Text numberOfLines={2} className="text-legenda text-text-secondary">
        {rotulo}
      </Text>
      <View className="flex-row items-center rounded-md border border-dark-border bg-dark-tertiary">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${rotulo}: ${valor || textos.semData}`}
          accessibilityHint={textos.abreCalendario}
          onPress={() => {
            Keyboard.dismiss();
            setAberto(true);
          }}
          className="flex-1 px-3 py-2 active:opacity-60"
        >
          <Text className={`text-campo ${valor ? 'text-text-bright' : 'text-text-secondary'}`}>{valor || textos.data}</Text>
        </Pressable>
        {valor ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${textos.limpar} ${rotulo}`}
            onPress={() => mudar('')}
            hitSlop={8}
            className="px-2 py-2 active:opacity-60"
          >
            <Text className="text-legenda font-semibold text-accent-blue">{textos.limpar}</Text>
          </Pressable>
        ) : null}
      </View>
      {aberto ? (
        <DateTimePicker
          value={dataDoTexto(valor) ?? hoje}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          maximumDate={hoje}
          minimumDate={minimo}
          onChange={escolher}
        />
      ) : null}
    </View>
  );
}

type PropsPasso = { icone: 'remove' | 'add'; rotulo: string; desativado?: boolean; aoTocar(): void };

function BotaoPasso({ icone, rotulo, desativado = false, aoTocar }: PropsPasso) {
  const paleta = usePaleta();
  const vibrar = useVibrar();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ disabled: desativado }}
      disabled={desativado}
      onPress={() => {
        vibrar();
        aoTocar();
      }}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      className="h-10 w-10 items-center justify-center active:opacity-60"
    >
      <Ionicons name={icone} size={18} color={desativado ? paleta.dark.border : paleta.text.bright} />
    </Pressable>
  );
}

/** Recontagem com − e + (mínimo 0), no visual do stepper do Progresso da Lista. */
function ContadorRecontagem({ tipo, valor, mudar }: { tipo: TipoMidia; valor: number; mudar(n: number): void }) {
  const nome = NOME_RECONTAGEM[tipo] ?? 'Recontagem';
  return (
    <View className="flex-1 justify-end gap-1">
      <Text numberOfLines={2} className="text-legenda text-text-secondary">
        {nome}
      </Text>
      <View className="flex-row items-center justify-between rounded-full border border-dark-border bg-dark-tertiary">
        <BotaoPasso icone="remove" rotulo={`Diminuir ${nome}`} desativado={valor <= 0} aoTocar={() => mudar(valor - 1)} />
        <Text
          accessibilityLabel={`${nome}: ${valor}`}
          accessibilityLiveRegion="polite"
          className="text-campo font-semibold text-text-bright"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {valor}×
        </Text>
        <BotaoPasso icone="add" rotulo={`Aumentar ${nome}`} aoTocar={() => mudar(valor + 1)} />
      </View>
    </View>
  );
}

function Alternar({ rotulo, icone, ativo, mudar }: { rotulo: string; icone: 'heart' | 'lock-closed'; ativo: boolean; mudar(): void }) {
  const paleta = usePaleta();
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
  const [edicao, setEdicao] = useState<EdicaoItem>(() => iniciarEdicao(item, tipo));
  const form = edicao.form;
  const [erro, setErro] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const salvar = useSalvarItem();
  const remover = useRemoverItem();
  const paleta = usePaleta();
  const vibrar = useVibrar();

  // Estado e Progresso andam juntos (ADR 0009): a tela mostra o que o backend vai gravar.
  const mudar = <K extends keyof FormularioItem>(campo: K) => (valor: FormularioItem[K]) =>
    setEdicao((e) => mudarEdicao(e, { [campo]: valor }, { tipo, total }));

  const enviar = async () => {
    const resultado = validarItem(form, { tipo, total });
    if (!resultado.ok) return setErro(resultado.erro);
    setErro(null);
    try {
      await salvar.mutateAsync({ idMidia: midia.id_midia, idLista: item?.id_lista, dados: resultado.dados });
      vibrar('sucesso');
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
      vibrar('sucesso');
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
            // PROTÓTIPO (ticket 29): o chip ativo ganha a cor dessaturada do Status.
            const cor = estado ? corDoEstado(estado, paleta) : paleta['marca-texto'];
            return (
              <Pressable
                key={rotulo}
                accessibilityRole="radio"
                accessibilityLabel={nome}
                accessibilityState={{ checked: ativo }}
                onPress={() => {
                  vibrar();
                  mudar('status_consumo')(rotulo);
                }}
                className="min-h-[40px] justify-center rounded-full border border-dark-border px-3 py-1.5"
                style={ativo ? { borderColor: cor, backgroundColor: `${cor}26` } : undefined}
              >
                <Text className={`text-corpo font-semibold ${ativo ? '' : 'text-text-secondary'}`} style={ativo ? { color: cor } : undefined}>
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
        <CampoCurto rotulo={textos.nota} value={form.nota} onChangeText={mudar('nota')} keyboardType="decimal-pad" placeholder="0 a 10" />
        <ContadorRecontagem tipo={tipo} valor={Number(form.recontagem) || 0} mudar={(n) => mudar('recontagem')(String(Math.max(0, n)))} />
      </View>

      <View className="flex-row gap-2">
        <CampoData rotulo={textos.inicio} valor={form.inicio} mudar={mudar('inicio')} />
        <CampoData rotulo={textos.conclusao} valor={form.conclusao} minimo={dataDoTexto(form.inicio) ?? undefined} mudar={mudar('conclusao')} />
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
