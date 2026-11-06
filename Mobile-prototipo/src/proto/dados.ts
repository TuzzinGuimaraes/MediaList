// PROTÓTIPO: dados simulados em memória. Nada aqui vem do backend.
import type { Estado, Tipo } from './dominio';

export type Midia = {
  id: number;
  tipo: Tipo;
  titulo: string;
  ano: number;
  generos: string[];
  sinopse: string;
  total: number | null; // episódios (anime) ou capítulos (mangá); null = em lançamento; jogos: sempre null
  demografia?: string;
  plataformas?: string[];
  notaMedia: number | null;
  totalAvaliacoes: number;
  popularidade: number;
  emAlta: number; // posição fictícia de trending
  cor: string; // pôster de mentira
};

export type Item = {
  idMidia: number;
  estado: Estado;
  progresso: number; // anime/mangá
  horas: number; // jogo (não mede Progresso)
  nota: number | null;
  favorito: boolean;
  privado: boolean;
  dataInicio: string;
  dataConclusao: string;
  recontagem: number;
  comentario: string;
};

const s = 'Sinopse simulada para o protótipo. Texto de exemplo com duas ou três linhas para dar densidade realista à tela de detalhe.';

export const MIDIAS: Midia[] = [
  { id: 1, tipo: 'anime', titulo: 'Frieren e a Jornada para Além', ano: 2023, generos: ['Aventura', 'Fantasia'], sinopse: s, total: 28, notaMedia: 9.1, totalAvaliacoes: 412, popularidade: 9800, emAlta: 1, cor: '#4a6fa5' },
  { id: 2, tipo: 'anime', titulo: 'Cowboy Bebop', ano: 1998, generos: ['Ficção científica', 'Ação'], sinopse: s, total: 26, notaMedia: 8.9, totalAvaliacoes: 980, popularidade: 12000, emAlta: 9, cor: '#a5524a' },
  { id: 3, tipo: 'anime', titulo: 'One Piece', ano: 1999, generos: ['Aventura', 'Comédia'], sinopse: s, total: null, notaMedia: 8.7, totalAvaliacoes: 1500, popularidade: 20000, emAlta: 2, cor: '#d18b2c' },
  { id: 4, tipo: 'anime', titulo: 'Mob Psycho 100', ano: 2016, generos: ['Ação', 'Comédia'], sinopse: s, total: 12, notaMedia: 8.5, totalAvaliacoes: 300, popularidade: 7000, emAlta: 6, cor: '#7a4aa5' },
  { id: 5, tipo: 'anime', titulo: 'Dungeon Meshi', ano: 2024, generos: ['Fantasia', 'Comédia'], sinopse: s, total: 24, notaMedia: null, totalAvaliacoes: 0, popularidade: 5000, emAlta: 3, cor: '#4aa57a' },
  { id: 6, tipo: 'manga', titulo: 'Berserk', ano: 1989, generos: ['Fantasia sombria', 'Ação'], sinopse: s, total: 374, demografia: 'Seinen', notaMedia: 9.4, totalAvaliacoes: 700, popularidade: 11000, emAlta: 5, cor: '#5a3a3a' },
  { id: 7, tipo: 'manga', titulo: 'Vagabond', ano: 1998, generos: ['Histórico', 'Ação'], sinopse: s, total: 327, demografia: 'Seinen', notaMedia: 9.2, totalAvaliacoes: 420, popularidade: 6000, emAlta: 10, cor: '#3a5a4a' },
  { id: 8, tipo: 'manga', titulo: 'Chainsaw Man', ano: 2018, generos: ['Ação', 'Terror'], sinopse: s, total: null, demografia: 'Shounen', notaMedia: 8.6, totalAvaliacoes: 650, popularidade: 14000, emAlta: 4, cor: '#c0392b' },
  { id: 9, tipo: 'manga', titulo: 'Yotsuba&!', ano: 2003, generos: ['Comédia', 'Slice of life'], sinopse: s, total: 6, demografia: 'Shounen', notaMedia: 8.8, totalAvaliacoes: 120, popularidade: 3000, emAlta: 12, cor: '#6ab04c' },
  { id: 10, tipo: 'jogo', titulo: 'Elden Ring', ano: 2022, generos: ['RPG', 'Ação'], sinopse: s, total: null, plataformas: ['PC', 'PS5', 'Xbox Series'], notaMedia: 9.3, totalAvaliacoes: 900, popularidade: 15000, emAlta: 1, cor: '#b8860b' },
  { id: 11, tipo: 'jogo', titulo: 'Hollow Knight', ano: 2017, generos: ['Metroidvania'], sinopse: s, total: null, plataformas: ['PC', 'Switch', 'PS4'], notaMedia: 9.0, totalAvaliacoes: 640, popularidade: 9000, emAlta: 4, cor: '#2c3e50' },
  { id: 12, tipo: 'jogo', titulo: 'Hades', ano: 2020, generos: ['Roguelike', 'Ação'], sinopse: s, total: null, plataformas: ['PC', 'Switch'], notaMedia: 8.9, totalAvaliacoes: 510, popularidade: 8000, emAlta: 3, cor: '#8e2c2c' },
  { id: 13, tipo: 'jogo', titulo: 'Stardew Valley', ano: 2016, generos: ['Simulação'], sinopse: s, total: null, plataformas: ['PC', 'Switch', 'Mobile'], notaMedia: 8.7, totalAvaliacoes: 450, popularidade: 10000, emAlta: 6, cor: '#27ae60' },
  { id: 14, tipo: 'jogo', titulo: 'Celeste', ano: 2018, generos: ['Plataforma'], sinopse: s, total: null, plataformas: ['PC', 'Switch'], notaMedia: 8.8, totalAvaliacoes: 300, popularidade: 5000, emAlta: 8, cor: '#8e44ad' },
  { id: 15, tipo: 'jogo', titulo: 'Baldur\'s Gate 3', ano: 2023, generos: ['RPG'], sinopse: s, total: null, plataformas: ['PC', 'PS5'], notaMedia: 9.5, totalAvaliacoes: 820, popularidade: 13000, emAlta: 2, cor: '#34495e' },
];

const base = { nota: null, favorito: false, privado: false, dataInicio: '', dataConclusao: '', recontagem: 0, comentario: '', horas: 0, progresso: 0 };

export const ITENS_INICIAIS: Item[] = [
  { ...base, idMidia: 1, estado: 'em_progresso', progresso: 26, nota: 9, dataInicio: '2026-10-01' },
  { ...base, idMidia: 2, estado: 'concluido', progresso: 26, nota: 10, favorito: true, recontagem: 1, dataInicio: '2025-01-10', dataConclusao: '2025-02-02' },
  { ...base, idMidia: 3, estado: 'em_progresso', progresso: 1120 },
  { ...base, idMidia: 4, estado: 'pausado', progresso: 5 },
  { ...base, idMidia: 5, estado: 'planejado' },
  { ...base, idMidia: 6, estado: 'em_progresso', progresso: 372, nota: 10, privado: true },
  { ...base, idMidia: 7, estado: 'abandonado', progresso: 80 },
  { ...base, idMidia: 9, estado: 'em_progresso', progresso: 5 },
  { ...base, idMidia: 10, estado: 'platinado', horas: 180, nota: 10, favorito: true, dataConclusao: '2023-06-01' },
  { ...base, idMidia: 11, estado: 'concluido', horas: 45, nota: 9 },
  { ...base, idMidia: 12, estado: 'em_progresso', horas: 22 },
  { ...base, idMidia: 13, estado: 'pausado', horas: 90 },
  { ...base, idMidia: 15, estado: 'planejado' },
];

export const NOTICIAS = [
  { id: 1, titulo: 'Temporada de inverno: os destaques', data: '2026-11-04', resumo: 'Os animes mais esperados da próxima temporada.' },
  { id: 2, titulo: 'Novo DLC anunciado para Elden Ring', data: '2026-11-02', resumo: 'Expansão chega no ano que vem.' },
  { id: 3, titulo: 'Berserk retorna após hiato', data: '2026-10-28', resumo: 'Novo capítulo publicado.' },
];

export const NOTIFICACOES = [
  { id: 1, texto: 'Frieren: episódio 27 disponível', lida: false },
  { id: 2, texto: 'Chainsaw Man: capítulo novo', lida: false },
  { id: 3, texto: 'One Piece: episódio novo', lida: true },
];

export function midiaPorId(id: number): Midia {
  return MIDIAS.find((m) => m.id === id)!;
}
