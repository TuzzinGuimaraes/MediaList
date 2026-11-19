import { type InputHTMLAttributes, useEffect, useEffectEvent, useState } from 'react';

const ATRASO_MS = 350;

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  /** Valor vigente (o da URL). */
  valor: string;
  /** Chamado com o texto aparado, um pouco depois de a pessoa parar de digitar. */
  mudar(valor: string): void;
  /** Texto que ainda não vale como filtro (ex.: busca de 1 letra) não é enviado. */
  aceitar?(valor: string): boolean;
};

/** Campo de filtro que só manda o valor depois de uma pausa na digitação. */
export function CampoAtrasado({ valor, mudar, aceitar = () => true, ...input }: Props) {
  const [texto, setTexto] = useState(valor);
  const [anterior, setAnterior] = useState(valor);
  // O valor mudou por fora (busca da nav, Limpar filtros): o campo acompanha.
  if (valor !== anterior) {
    setAnterior(valor);
    if (valor !== texto.trim()) setTexto(valor);
  }

  const enviar = useEffectEvent((v: string) => mudar(v));
  const valido = useEffectEvent((v: string) => aceitar(v));
  useEffect(() => {
    const limpo = texto.trim();
    if (limpo === valor || !valido(limpo)) return;
    const espera = setTimeout(() => enviar(limpo), ATRASO_MS);
    return () => clearTimeout(espera);
  }, [texto, valor]);

  return <input {...input} value={texto} onChange={(e) => setTexto(e.target.value)} />;
}
