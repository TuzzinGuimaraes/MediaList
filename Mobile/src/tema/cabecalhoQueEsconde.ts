type Passo = {
  /** Quanto o cabeçalho já subiu (0 = inteiro, `altura` = escondido). */
  atual: number;
  /** Posição da rolagem agora e no evento anterior. */
  y: number;
  yAnterior: number;
  altura: number;
};

/**
 * Quanto o cabeçalho deve subir depois de um evento de rolagem: anda o mesmo que a rolagem,
 * preso entre 0 e a própria altura (clamp). No topo, ou no repique acima dele, fica inteiro.
 */
export function deslocarCabecalho({ atual, y, yAnterior, altura }: Passo): number {
  'worklet';
  if (y <= 0) return 0;
  return Math.min(Math.max(atual + y - yAnterior, 0), altura);
}
