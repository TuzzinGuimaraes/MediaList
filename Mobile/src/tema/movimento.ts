import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Preferência "reduzir movimento" do sistema: com ela ligada, as transições são instantâneas. */
export function useReduzirMovimento(): boolean {
  const [reduzir, setReduzir] = useState(false);
  useEffect(() => {
    let vivo = true;
    AccessibilityInfo.isReduceMotionEnabled().then((valor) => {
      if (vivo) setReduzir(valor);
    });
    const assinatura = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduzir);
    return () => {
      vivo = false;
      assinatura.remove();
    };
  }, []);
  return reduzir;
}
