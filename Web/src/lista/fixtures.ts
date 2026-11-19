// Itens de lista e Mídias para os testes de tela da Lista e do editor.
import type { Esquemas } from '../api/tipos';
import type { Rotas } from '../testes/fetchSimulado';

export type ItemLista = Esquemas['ItemLista'];
type Midia = Esquemas['Midia'];

let seq = 0;

/** Um Item de GET /lista; por padrão um anime em Assistindo, 3 de 12. */
export function umItem(campos: Partial<ItemLista> = {}): ItemLista {
  seq += 1;
  return {
    id_lista: `LST-${seq}`,
    id_midia: `MID-${seq}`,
    tipo: 'anime',
    titulo_original: `Obra ${seq}`,
    titulo_portugues: null,
    titulo_ingles: null,
    status_consumo: 'assistindo',
    progresso_atual: 3,
    progresso_total: 12,
    numero_episodios: 12,
    numero_capitulos: null,
    numero_volumes: null,
    nota_usuario: null,
    favorito: false,
    privado: false,
    comentario: null,
    data_inicio: null,
    data_conclusao: null,
    total_rewatches: 0,
    data_adicao: '2026-10-01T10:00:00',
    data_atualizacao: '2026-10-01T10:00:00',
    data_lancamento: '2020-01-01',
    generos: null,
    generos_lista: [],
    poster_url: null,
    banner_url: null,
    sinopse: null,
    autor: null,
    estudio: null,
    desenvolvedor: null,
    publicadora: null,
    plataformas: null,
    fonte_original: null,
    demografia: null,
    modo_jogo: null,
    nota_media: null,
    nota_fonte: null,
    origem_nota: null,
    status_anime: 'finalizado',
    status_manga: null,
    status_jogo: null,
    status_catalogo: 'finalizado',
    ...campos,
  } as ItemLista;
}

/** Uma Mídia de listagem (Em alta). */
export function umaMidia(campos: Partial<Midia> = {}): Midia {
  seq += 1;
  return {
    id_midia: `MID-${seq}`,
    tipo: 'anime',
    titulo_original: `Sugestão ${seq}`,
    titulo_portugues: null,
    poster_url: null,
    nota_media: null,
    nota_fonte: null,
    origem_nota: null,
    ...campos,
  } as Midia;
}

/** GET /lista com `itens` e Em alta vazio (ou `emAlta`) nos dois Tipos do catálogo. */
export function rotasDaLista(itens: ItemLista[], emAlta: Midia[] = []): Rotas {
  return {
    'GET /lista': { status: 200, corpo: { lista: itens } },
    'GET /midias/trending': (req) => ({
      status: 200,
      corpo: { midias: emAlta.filter((m) => m.tipo === req.query.get('tipo')) },
    }),
  };
}
