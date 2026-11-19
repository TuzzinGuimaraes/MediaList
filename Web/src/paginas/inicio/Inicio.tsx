// Início (Resolution do 29): destaques de Em alta e, abaixo, as fileiras do catálogo.
import { useCatalogo } from '../../catalogo/CatalogoContext';
import { Carregando } from '../../componentes/Estados';
import { ALTURA_NAV } from '../../layout/Casca';
import { useEmAlta, useLista } from './consultas';
import { Destaques } from './Destaques';
import { useEditorDoItem } from './editorDoItem';

const MAX_DESTAQUES = 5;

export function Inicio() {
  const { recorte } = useCatalogo();
  const emAlta = useEmAlta(recorte);
  const lista = useLista();
  const { abrirEditor, editor } = useEditorDoItem();

  if (!emAlta.data) {
    return (
      <div style={{ paddingTop: ALTURA_NAV }}>
        <Carregando />
      </div>
    );
  }
  return (
    <div className="pb-24">
      <h1 className="sr-only">Início</h1>
      <Destaques
        midias={emAlta.data.slice(0, MAX_DESTAQUES)}
        itens={lista.data}
        posicaoTop={() => null}
        abrirEditor={abrirEditor}
      />
      {editor}
    </div>
  );
}
