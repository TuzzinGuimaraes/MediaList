// PROTÓTIPO: corpo do editor do Item de lista + embrulho bottom sheet (Modal nativo).
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Botao, Chip, Poster } from './componentes';
import { midiaPorId, type Item } from './dados';
import { NOME_ESTADO, estadosValidos, rotulo, unidade } from './dominio';
import { useProto } from './estado';
import { cores } from './tema';

function novoItem(idMidia: number): Item {
  return { idMidia, estado: 'planejado', progresso: 0, horas: 0, nota: null, favorito: false, privado: false, dataInicio: '', dataConclusao: '', recontagem: 0, comentario: '' };
}

function Stepper({ valor, onChange, max, sufixo }: { valor: number; onChange: (n: number) => void; max?: number | null; sufixo?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Pressable style={e.passo} onPress={() => onChange(Math.max(0, valor - 1))}><Text style={e.passoTxt}>−</Text></Pressable>
      <Text style={{ color: cores.textoForte, minWidth: 80, textAlign: 'center', fontSize: 16 }}>
        {valor}{max != null ? ` / ${max}` : ''}{sufixo ? ` ${sufixo}` : ''}
      </Text>
      <Pressable style={e.passo} onPress={() => onChange(max != null ? Math.min(max, valor + 1) : valor + 1)}><Text style={e.passoTxt}>+</Text></Pressable>
    </View>
  );
}

export function EditorForm({ idMidia, onFechar }: { idMidia: number; onFechar: () => void }) {
  const { item, salvar, remover } = useProto();
  const m = midiaPorId(idMidia);
  const existente = item(idMidia);
  const [d, setD] = useState<Item>(existente ?? novoItem(idMidia));
  const [confirmando, setConfirmando] = useState(false);
  const set = (p: Partial<Item>) => setD({ ...d, ...p });

  function setProgresso(p: number) {
    const atingiu = m.total !== null && p === m.total;
    set({ progresso: p, estado: atingiu ? 'concluido' : d.estado });
  }

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Poster midia={m} w={48} h={70} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: cores.textoForte, fontWeight: '700', fontSize: 16 }}>{m.titulo}</Text>
          <Text style={{ color: cores.textoSec }}>{existente ? 'Editando Item de lista' : 'Novo Item de lista'}</Text>
        </View>
        <Pressable onPress={() => set({ favorito: !d.favorito })}>
          <Text style={{ fontSize: 24, color: d.favorito ? cores.vermelho : cores.textoSec }}>{d.favorito ? '♥' : '♡'}</Text>
        </Pressable>
      </View>

      <View>
        <Text style={e.rotulo}>Estado (só Rótulos válidos para {m.tipo})</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {estadosValidos(m.tipo).map((s) => (
            <Chip key={s} texto={rotulo(m.tipo, s)} ativo={d.estado === s} onPress={() => set({ estado: s })} />
          ))}
        </View>
        <Text style={e.dica}>Estado de consumo: {NOME_ESTADO[d.estado]}</Text>
      </View>

      {m.tipo === 'jogo' ? (
        <View>
          <Text style={e.rotulo}>Horas jogadas (não medem Progresso)</Text>
          <Stepper valor={d.horas} onChange={(h) => set({ horas: h })} sufixo="h" />
        </View>
      ) : (
        <View>
          <Text style={e.rotulo}>Progresso ({m.tipo === 'anime' ? 'episódios' : 'capítulos'})</Text>
          <Stepper valor={d.progresso} onChange={setProgresso} max={m.total} sufixo={unidade(m.tipo)} />
        </View>
      )}

      <View>
        <Text style={e.rotulo}>Nota pessoal (0–10)</Text>
        <Stepper valor={d.nota ?? 0} onChange={(n) => set({ nota: Math.min(10, n) })} max={10} />
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={e.rotulo}>Início</Text>
          <TextInput style={e.input} value={d.dataInicio} onChangeText={(t) => set({ dataInicio: t })} placeholder="AAAA-MM-DD" placeholderTextColor={cores.textoSec} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={e.rotulo}>Conclusão</Text>
          <TextInput style={e.input} value={d.dataConclusao} onChangeText={(t) => set({ dataConclusao: t })} placeholder="AAAA-MM-DD" placeholderTextColor={cores.textoSec} />
        </View>
      </View>

      <View>
        <Text style={e.rotulo}>Recontagem</Text>
        <Stepper valor={d.recontagem} onChange={(n) => set({ recontagem: n })} />
      </View>

      <View>
        <Text style={e.rotulo}>Comentário</Text>
        <TextInput style={[e.input, { minHeight: 60 }]} multiline value={d.comentario} onChangeText={(t) => set({ comentario: t })} placeholder="Anotações pessoais..." placeholderTextColor={cores.textoSec} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: cores.texto }}>Privado</Text>
        <Switch value={d.privado} onValueChange={(v) => set({ privado: v })} />
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        {existente && !confirmando && <Botao titulo="Remover" cor={cores.vermelho} onPress={() => setConfirmando(true)} />}
        {existente && confirmando && (
          <Botao titulo="Confirmar remoção" cor={cores.vermelho} onPress={() => { remover(idMidia); onFechar(); }} />
        )}
        <Botao titulo="Cancelar" cor={cores.borda} onPress={onFechar} style={{ flex: 1 }} />
        <Botao titulo="Salvar" onPress={() => { salvar(d); onFechar(); }} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

export function EditorSheet() {
  const { sheetAberto, fecharSheet } = useProto();
  return (
    <Modal visible={sheetAberto !== null} transparent animationType="slide" onRequestClose={fecharSheet}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={fecharSheet}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' }} />
        </Pressable>
        <View style={e.sheet}>
          <View style={e.alca} />
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
            {sheetAberto !== null && <EditorForm key={sheetAberto} idMidia={sheetAberto} onFechar={fecharSheet} />}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const e = StyleSheet.create({
  rotulo: { color: cores.textoSec, fontSize: 12, marginBottom: 6 },
  dica: { color: cores.textoSec, fontSize: 11, marginTop: 2 },
  input: { backgroundColor: cores.fundo, borderWidth: 1, borderColor: cores.borda, borderRadius: 6, color: cores.texto, padding: 8 },
  passo: { width: 40, height: 36, borderRadius: 6, backgroundColor: cores.superficie, borderWidth: 1, borderColor: cores.borda, alignItems: 'center', justifyContent: 'center' },
  passoTxt: { color: cores.textoForte, fontSize: 18, fontWeight: '700' },
  sheet: { backgroundColor: cores.superficie2, borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '85%', borderTopWidth: 1, borderColor: cores.borda },
  alca: { width: 40, height: 4, borderRadius: 2, backgroundColor: cores.borda, alignSelf: 'center', marginTop: 8 },
});
