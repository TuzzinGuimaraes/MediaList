import { useEffect, useState } from 'react';

const MINUTO = 60_000;

/** O instante de agora, renovado a cada minuto ("foi ao ar", o marcador "agora", a virada do dia). */
export function useAgora(): Date {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), MINUTO);
    return () => clearInterval(id);
  }, []);
  return agora;
}
