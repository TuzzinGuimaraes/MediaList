// PROTÓTIPO: estado global em memória (Recorte, Itens, variações ativas).
import { router } from 'expo-router';
import { createContext, useContext, useState, type ReactNode } from 'react';

import { ITENS_INICIAIS, midiaPorId, type Item } from './dados';
import { NOME_ESTADO, type Recorte } from './dominio';

export const VARIANTES = {
  lista: [
    { chave: 'secoes', nome: 'Seções por Estado' },
    { chave: 'abas', nome: 'Abas por Estado' },
  ],
  editor: [
    { chave: 'sheet', nome: 'Bottom sheet' },
    { chave: 'tela', nome: 'Tela cheia' },
  ],
  mais1: [
    { chave: 'botao', nome: 'Botão +1 no card' },
    { chave: 'stepper', nome: 'Stepper − / +' },
    { chave: 'gesto', nome: 'Deslizar → para +1' },
  ],
} as const;

export type Dimensao = keyof typeof VARIANTES;
export type Variantes = { [D in Dimensao]: (typeof VARIANTES)[D][number]['chave'] };

type Ctx = {
  recorte: Recorte;
  setRecorte: (r: Recorte) => void;
  itens: Item[];
  item: (idMidia: number) => Item | undefined;
  variantes: Variantes;
  ciclarVariante: (d: Dimensao, passo: 1 | -1) => void;
  itemAtual: number | null;
  ultimaAcao: string;
  incrementar: (idMidia: number, delta: 1 | -1) => void;
  salvar: (novo: Item) => void;
  remover: (idMidia: number) => void;
  abrirEditor: (idMidia: number) => void;
  sheetAberto: number | null;
  fecharSheet: () => void;
};

const Contexto = createContext<Ctx | null>(null);

export function useProto(): Ctx {
  const c = useContext(Contexto);
  if (!c) throw new Error('fora do ProtoProvider');
  return c;
}

export function ProtoProvider({ children }: { children: ReactNode }) {
  const [recorte, setRecorte] = useState<Recorte>('animanga');
  const [itens, setItens] = useState<Item[]>(ITENS_INICIAIS);
  const [variantes, setVariantes] = useState<Variantes>({ lista: 'secoes', editor: 'sheet', mais1: 'botao' });
  const [itemAtual, setItemAtual] = useState<number | null>(1);
  const [ultimaAcao, setUltimaAcao] = useState('—');
  const [sheetAberto, setSheetAberto] = useState<number | null>(null);

  const item = (id: number) => itens.find((i) => i.idMidia === id);

  function ciclarVariante(d: Dimensao, passo: 1 | -1) {
    const opcoes = VARIANTES[d].map((o) => o.chave) as string[];
    const idx = opcoes.indexOf(variantes[d]);
    const prox = opcoes[(idx + passo + opcoes.length) % opcoes.length];
    setVariantes({ ...variantes, [d]: prox } as Variantes);
    setUltimaAcao(`variação ${d} → ${prox}`);
  }

  // Regra: Progresso nunca excede o total; atingir o total leva a Concluído. Jogo não tem Progresso.
  function incrementar(idMidia: number, delta: 1 | -1) {
    const m = midiaPorId(idMidia);
    const atual = item(idMidia);
    setItemAtual(idMidia);
    if (!atual) return;
    if (m.tipo === 'jogo') {
      setUltimaAcao(`${delta > 0 ? '+1' : '−1'} ignorado: jogo não tem Progresso`);
      return;
    }
    let p = Math.max(0, atual.progresso + delta);
    if (m.total !== null) p = Math.min(p, m.total);
    if (p === atual.progresso) {
      setUltimaAcao(`${delta > 0 ? '+1' : '−1'} bloqueado: limite (${p}/${m.total ?? '?'})`);
      return;
    }
    const concluiu = m.total !== null && p === m.total && atual.estado !== 'concluido';
    const novo: Item = { ...atual, progresso: p, estado: concluiu ? 'concluido' : atual.estado };
    setItens((xs) => xs.map((x) => (x.idMidia === idMidia ? novo : x)));
    setUltimaAcao(`${delta > 0 ? '+1' : '−1'} → ${p}/${m.total ?? '?'}${concluiu ? ` · atingiu o total → ${NOME_ESTADO.concluido}` : ''}`);
  }

  function salvar(novo: Item) {
    setItens((xs) => (xs.some((x) => x.idMidia === novo.idMidia) ? xs.map((x) => (x.idMidia === novo.idMidia ? novo : x)) : [...xs, novo]));
    setItemAtual(novo.idMidia);
    setUltimaAcao(`salvo pelo editor (${NOME_ESTADO[novo.estado]})`);
  }

  function remover(idMidia: number) {
    setItens((xs) => xs.filter((x) => x.idMidia !== idMidia));
    setItemAtual(idMidia);
    setUltimaAcao('removido da Lista pessoal');
  }

  function abrirEditor(idMidia: number) {
    setItemAtual(idMidia);
    setUltimaAcao(`editor aberto (${variantes.editor === 'sheet' ? 'bottom sheet' : 'tela cheia'})`);
    if (variantes.editor === 'sheet') setSheetAberto(idMidia);
    else router.push({ pathname: '/editor/[id]', params: { id: String(idMidia) } });
  }

  return (
    <Contexto.Provider
      value={{
        recorte, setRecorte, itens, item, variantes, ciclarVariante, itemAtual, ultimaAcao,
        incrementar, salvar, remover, abrirEditor, sheetAberto, fecharSheet: () => setSheetAberto(null),
      }}>
      {children}
    </Contexto.Provider>
  );
}
