// Ponto único por onde o Início abre o editor do Item (adicionar ou editar).
// TODO(web-novo 07): trocar este stub pelo editor do ticket 07 (contexto/gancho
// `abrirEditor(midia, item)`); o Início só chama `abrirEditor` e renderiza `editor`.
import { type ReactNode, useState } from 'react';

import type { Esquemas } from '../../api/tipos';
import { Vazio } from '../../componentes/Estados';
import { Modal } from '../../componentes/Camada';

type Midia = Esquemas['Midia'];
type ItemLista = Esquemas['ItemLista'];

/** Abre o editor da Mídia: com o Item dela, edita; com null, adiciona à Lista. */
export type AbrirEditor = (midia: Midia, item: ItemLista | null) => void;

export function useEditorDoItem(): { abrirEditor: AbrirEditor; editor: ReactNode } {
  const [aberto, setAberto] = useState<{ item: ItemLista | null } | null>(null);
  const editor = (
    <Modal titulo={aberto?.item ? 'Editar' : 'Adicionar à Lista'} aberto={aberto !== null} fechar={() => setAberto(null)}>
      <Vazio texto="O editor do Item chega com a Lista." />
    </Modal>
  );
  return { abrirEditor: (_midia, item) => setAberto({ item }), editor };
}
