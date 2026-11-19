// Ponto único de abertura do editor do Item a partir do detalhe: `abrirEditor(midia, item)`.
// TODO(web-novo 07): trocar o corpo deste arquivo pelo editor do Item do ticket 07, mantendo
// a assinatura de `useEditorDoItem`.
import { type ReactNode, useState } from 'react';

import type { Esquemas } from '../../api/tipos';
import { Modal } from '../../componentes/Camada';

type Midia = Esquemas['MidiaDetalhe'];
type Item = Esquemas['ItemLista'];

export type AbrirEditor = (midia: Midia, item: Item | null) => void;

/** O `abrirEditor` e o elemento do editor, para a tela renderizar onde quiser. */
export function useEditorDoItem(): [AbrirEditor, ReactNode] {
  const [aberto, setAberto] = useState<{ midia: Midia; item: Item | null } | null>(null);
  const editor = (
    <Modal
      titulo={aberto?.item ? 'Editar na Lista' : 'Adicionar à Lista'}
      aberto={aberto !== null}
      fechar={() => setAberto(null)}
    >
      <p className="text-texto-suave">O editor do Item chega com a Lista (ticket 07).</p>
    </Modal>
  );
  return [(midia, item) => setAberto({ midia, item }), editor];
}
