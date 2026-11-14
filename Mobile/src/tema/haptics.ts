import * as Haptics from 'expo-haptics';

/** Impacto leve ao salvar ou remover um Item; sem suporte no aparelho, nada acontece. */
export function vibrarConfirmacao(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
