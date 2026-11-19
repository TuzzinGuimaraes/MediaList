// Ponto único para abrir o editor do Item de lista de qualquer tela (Lista, Início,
// detalhe): `useEditorItem().abrirEditor(midia, item | null)`. O provedor fica na raiz do
// app e monta o editor só enquanto está aberto.
import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';

import { EditorItem, type MidiaDoEditor } from './EditorItem';
import type { ItemLista } from './api';

type ValorEditor = {
  /** Abre o editor da `midia`; `item` null adiciona à Lista, o Item existente edita. */
  abrirEditor(midia: MidiaDoEditor, item: ItemLista | null): void;
};

const EditorItemContext = createContext<ValorEditor | null>(null);

type Aberto = { midia: MidiaDoEditor; item: ItemLista | null };

export function EditorItemProvider({ children }: { children: ReactNode }) {
  const [aberto, setAberto] = useState<Aberto | null>(null);
  const valor = useMemo<ValorEditor>(() => ({ abrirEditor: (midia, item) => setAberto({ midia, item }) }), []);
  return (
    <EditorItemContext.Provider value={valor}>
      {children}
      {aberto ? (
        <EditorItem
          // Outra Mídia (ou outro Item) recomeça o formulário.
          key={`${aberto.midia.id_midia}-${aberto.item?.id_lista ?? 'novo'}`}
          midia={aberto.midia}
          item={aberto.item}
          fechar={() => setAberto(null)}
        />
      ) : null}
    </EditorItemContext.Provider>
  );
}

export function useEditorItem(): ValorEditor {
  const valor = useContext(EditorItemContext);
  if (!valor) throw new Error('useEditorItem fora do EditorItemProvider');
  return valor;
}
