// Rotas que o Início pede. Os testes de outras telas que passam pelo Início espalham
// `rotasDoInicio()` no `simularFetch` e sobrescrevem só o que interessa.
import type { Resposta } from './fetchSimulado';

const TIPOS = ['anime', 'manga', 'jogo'] as const;
const ORDENS = ['nota_media', 'data_lancamento', 'mais_adicionados', 'mais_concluidos'] as const;
/** Os gêneros das Mídias de `midias.ts`: os carrosséis "Porque você curte" pedem por eles. */
const GENEROS = ['Ação', 'Aventura', 'Drama', 'Fantasia'];

type Tipo = (typeof TIPOS)[number];
type Ordem = (typeof ORDENS)[number];

/** A rota de um carrossel de catálogo do Início, como o app monta (URLSearchParams). */
export function rotaCarrossel(tipo: Tipo, ordem: Ordem, genero?: string): string {
  const params = new URLSearchParams({ tipo, ordem, por_pagina: '20' });
  if (genero) params.set('genero', genero);
  return `GET /midias?${params}`;
}

const vazia: Resposta = { status: 200, corpo: { midias: [] } };

/** Tudo vazio: trending, populares, Lista e os carrosséis de catálogo de todos os Tipos. */
export function rotasDoInicio(): Record<string, Resposta> {
  const rotas: Record<string, Resposta> = { 'GET /lista': { status: 200, corpo: { lista: [] } } };
  for (const tipo of TIPOS) {
    rotas[`GET /midias/trending?tipo=${tipo}&limite=10`] = vazia;
    rotas[`GET /midias/populares?tipo=${tipo}`] = vazia;
    for (const ordem of ORDENS) rotas[rotaCarrossel(tipo, ordem)] = vazia;
    for (const genero of GENEROS) rotas[rotaCarrossel(tipo, 'nota_media', genero)] = vazia;
  }
  return rotas;
}
