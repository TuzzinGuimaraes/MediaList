import { Opcoes } from '../componentes/Opcoes';
import { PREFERENCIAS } from './tema';
import { useTema } from './TemaContext';

/** Seletor Sistema/Escuro/Claro (fica no Perfil, Resolution do 29). */
export function SeletorTema() {
  const { preferencia, escolher } = useTema();
  return (
    <Opcoes
      rotulo="Tema"
      opcoes={PREFERENCIAS.map((p) => ({ valor: p.valor, nome: p.nome }))}
      valor={preferencia}
      mudar={escolher}
    />
  );
}
