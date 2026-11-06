// PROTÓTIPO: regras do CONTEXT.md, simplificadas.
export type Tipo = 'anime' | 'manga' | 'jogo';
export type Recorte = 'animanga' | 'jogos';
export type Estado = 'planejado' | 'em_progresso' | 'pausado' | 'abandonado' | 'concluido' | 'platinado';

export const ORDEM_ESTADOS: Estado[] = ['em_progresso', 'planejado', 'pausado', 'concluido', 'platinado', 'abandonado'];

export const NOME_ESTADO: Record<Estado, string> = {
  planejado: 'Planejado',
  em_progresso: 'Em progresso',
  pausado: 'Pausado',
  abandonado: 'Abandonado',
  concluido: 'Concluído',
  platinado: 'Platinado',
};

// Rótulo de estado por Tipo de mídia (null = não existe para o Tipo)
const ROTULOS: Record<Tipo, Record<Estado, string | null>> = {
  anime: { planejado: 'planejado', em_progresso: 'assistindo', pausado: 'pausado', abandonado: 'abandonado', concluido: 'completo', platinado: null },
  manga: { planejado: 'planejado', em_progresso: 'lendo', pausado: 'pausado', abandonado: 'abandonado', concluido: 'lido', platinado: null },
  jogo: { planejado: 'na_fila', em_progresso: 'jogando', pausado: 'pausado', abandonado: 'abandonado', concluido: 'zerado', platinado: 'platinado' },
};

const TEXTO_ROTULO: Record<string, string> = {
  planejado: 'Planejado', assistindo: 'Assistindo', lendo: 'Lendo', jogando: 'Jogando', pausado: 'Pausado',
  abandonado: 'Abandonado', completo: 'Completo', lido: 'Lido', zerado: 'Zerado', platinado: 'Platinado', na_fila: 'Na fila',
};

export function rotulo(tipo: Tipo, estado: Estado): string {
  const r = ROTULOS[tipo][estado];
  return r ? TEXTO_ROTULO[r] : '—';
}

export function estadosValidos(tipo: Tipo): Estado[] {
  return ORDEM_ESTADOS.filter((e) => ROTULOS[tipo][e] !== null);
}

// Platinado ⊂ Concluído nas contagens
export function contaComo(estado: Estado): Estado {
  return estado === 'platinado' ? 'concluido' : estado;
}

export function tiposDoRecorte(r: Recorte): Tipo[] {
  return r === 'animanga' ? ['anime', 'manga'] : ['jogo'];
}

export const NOME_TIPO: Record<Tipo, string> = { anime: 'Anime', manga: 'Mangá', jogo: 'Jogo' };

export function unidade(tipo: Tipo): string {
  return tipo === 'anime' ? 'ep' : tipo === 'manga' ? 'cap' : 'h';
}
