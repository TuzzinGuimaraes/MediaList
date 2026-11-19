// Ícones de traço (geometria do Feather), em SVG inline, sem dependência.
const CAMINHOS = {
  busca: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  filtro: 'M4 6h16M7 12h10M10 18h4',
  esquerda: 'M15 18l-6-6 6-6',
  direita: 'M9 18l6-6-6-6',
  baixo: 'M6 9l6 6 6-6',
  mais: 'M12 5v14M5 12h14',
  menos: 'M5 12h14',
  fechar: 'M18 6L6 18M6 6l12 12',
  estrela: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  coracao: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z',
  editar: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z',
  escudo: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  usuario: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  sair: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  sino: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0',
  menu: 'M3 6h18M3 12h18M3 18h18',
  alerta: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 8v4M12 16h.01',
} as const;

export type NomeIcone = keyof typeof CAMINHOS;

type Props = { nome: NomeIcone; tamanho?: number; cheio?: boolean; className?: string };

/** Decorativo (aria-hidden): o nome acessível vem do botão ou link em volta. */
export function Icone({ nome, tamanho = 18, cheio = false, className = '' }: Props) {
  return (
    <svg
      aria-hidden
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill={cheio ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      <path d={CAMINHOS[nome]} />
    </svg>
  );
}
