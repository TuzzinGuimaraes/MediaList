// Preferências da Lista do web (ticket 39): formato, Ordem e direção, salvos no
// localStorage por Usuário (a chave leva o id). Valor ilegível ou de versão antiga cai no
// padrão campo a campo.
import { useCallback, useEffect, useState } from 'react';

import { ORDENS_DA_LISTA, type OrdemLista } from '@dominio/filtrosLista';

import { useUsuario } from '../../sessao/SessaoContext';

/**
 * Formatos da Lista: a grade de capas (o padrão) e as linhas compacta e só texto, as
 * preferências de quem as escolhe (veredito do ticket 39). O componente de cada um fica em
 * `COLECOES` (Colecao.tsx).
 */
export const FORMATOS = ['grade', 'compacta', 'texto'] as const;
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
  const [estado, setEstado] = useState(() => ({ id, mudou: false, preferencias: lerPreferencias(id) }));
  // Outro Usuário na mesma aba (sair e entrar): relê as dele.
  const atual = estado.id === id ? estado.preferencias : lerPreferencias(id);
  if (estado.id !== id) setEstado({ id, mudou: false, preferencias: atual });

  // O updater do setEstado fica puro (o React pode chamá-lo duas vezes); gravar é efeito, e
  // só depois de uma mudança (o que se leu não volta para o armazenamento).
  const mudar = useCallback(
    (mudanca: Partial<PreferenciasLista>) => setEstado((e) => ({ ...e, mudou: true, preferencias: { ...e.preferencias, ...mudanca } })),
    [],
  );
  useEffect(() => {
    if (estado.mudou) salvarPreferencias(estado.id, estado.preferencias);
  }, [estado]);
  return [atual, mudar];
}

/** Busca da rota /lista: só `?formato=`, que vence o salvo e passa a ser o salvo. */
export type BuscaLista = { formato?: FormatoLista };

export function validarBuscaLista(s: Record<string, unknown>): BuscaLista {
  return formatoValido(s.formato) ? { formato: s.formato } : {};
}
