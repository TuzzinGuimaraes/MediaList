// Preferências da Lista do web (ticket 39): formato, Ordem e direção, salvos no
// localStorage por Usuário (a chave leva o id). Valor ilegível ou de versão antiga cai no
// padrão campo a campo.
import { useCallback, useState } from 'react';

import { ORDENS_DA_LISTA, type OrdemLista } from '@dominio/filtrosLista';

import { useUsuario } from '../../sessao/SessaoContext';

/**
 * Formatos da Lista. Hoje só a grade de capas; o ticket 02 acrescenta as linhas ("compacta",
 * "texto"), o componente de cada uma em `COLECOES` (Colecao.tsx) e o alternador com `?formato=`.
 */
export const FORMATOS = ['grade'] as const;
export type FormatoLista = (typeof FORMATOS)[number];

export type PreferenciasLista = { formato: FormatoLista; ordem: OrdemLista; inversa: boolean };

export const PREFERENCIAS_PADRAO: PreferenciasLista = { formato: 'grade', ordem: 'padrao', inversa: false };

export const chaveDasPreferencias = (idUsuario: string) => `medialist.lista.${idUsuario}`;

export function formatoValido(valor: unknown): valor is FormatoLista {
  return (FORMATOS as readonly unknown[]).includes(valor);
}

export function lerPreferencias(idUsuario: string): PreferenciasLista {
  let salvo: Partial<Record<keyof PreferenciasLista, unknown>> = {};
  try {
    const bruto: unknown = JSON.parse(localStorage.getItem(chaveDasPreferencias(idUsuario)) ?? '{}');
    if (bruto && typeof bruto === 'object') salvo = bruto;
  } catch {
    // Sem armazenamento ou JSON quebrado: o padrão.
  }
  return {
    formato: formatoValido(salvo.formato) ? salvo.formato : PREFERENCIAS_PADRAO.formato,
    ordem: ORDENS_DA_LISTA.includes(salvo.ordem as OrdemLista) ? (salvo.ordem as OrdemLista) : PREFERENCIAS_PADRAO.ordem,
    inversa: typeof salvo.inversa === 'boolean' ? salvo.inversa : PREFERENCIAS_PADRAO.inversa,
  };
}

function salvarPreferencias(idUsuario: string, preferencias: PreferenciasLista) {
  try {
    localStorage.setItem(chaveDasPreferencias(idUsuario), JSON.stringify(preferencias));
  } catch {
    // Sem armazenamento, vale até recarregar.
  }
}

/** As preferências do Usuário da sessão; `mudar` grava na hora. */
export function usePreferenciasDaLista(): [PreferenciasLista, (mudanca: Partial<PreferenciasLista>) => void] {
  const { id } = useUsuario();
  const [estado, setEstado] = useState(() => ({ id, preferencias: lerPreferencias(id) }));
  // Outro Usuário na mesma aba (sair e entrar): relê as dele.
  const atual = estado.id === id ? estado.preferencias : lerPreferencias(id);
  if (estado.id !== id) setEstado({ id, preferencias: atual });

  const mudar = useCallback(
    (mudanca: Partial<PreferenciasLista>) =>
      setEstado((e) => {
        const preferencias = { ...e.preferencias, ...mudanca };
        salvarPreferencias(e.id, preferencias);
        return { ...e, preferencias };
      }),
    [],
  );
  return [atual, mudar];
}
