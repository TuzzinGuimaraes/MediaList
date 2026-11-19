/**
 * Comparador do maior para o menor pela chave (número ou texto ISO); sem valor (null) vai
 * para o fim. Empate dá 0, para quem chama desempatar.
 */
export function decrescente<T>(chave: (item: T) => number | string | null) {
  return (a: T, b: T): number => {
    const [va, vb] = [chave(a), chave(b)];
    if (va === vb) return 0;
    if (va === null) return 1;
    if (vb === null) return -1;
    return va < vb ? 1 : -1;
  };
}
