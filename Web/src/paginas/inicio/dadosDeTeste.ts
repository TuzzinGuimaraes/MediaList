// Dados dos testes do Início: Mídias, Itens, Sugestões e as rotas que a tela consulta.
import type { Esquemas } from '../../api/tipos';
import type { Requisicao, Resposta, Rotas } from '../../testes/fetchSimulado';

type Midia = Esquemas['Midia'];
type ItemLista = Esquemas['ItemLista'];
type MidiaPopular = Esquemas['MidiaPopular'];
type Sugestao = Esquemas['Sugestao'];
type MotivoDaSugestao = Esquemas['MotivoDaSugestao'];

export function midia(id: string, titulo: string, campos: Partial<Midia> = {}): Midia {
  return {
    id_midia: id,
    titulo_original: titulo,
    titulo_romaji: null,
    titulo_ingles: null,
    tipo: 'anime',
    sinopse: null,
    poster_url: null,
    banner_url: null,
    trailer_url: null,
    data_lancamento: '2020-01-01',
    generos: null,
    generos_lista: [],
    nota_media: null,
    nota_fonte: null,
    origem_nota: null,
    total_avaliacoes: null,
    total_usuarios: 0,
    total_concluidos: 0,
    classificacao: null,
    classificacao_etaria: null,
    status_anime: null,
    status_manga: null,
    status_jogo: null,
    status_catalogo: null,
    numero_episodios: null,
    episodios_lancados: null,
    proximo_episodio_em: null,
    temporada_estacao: null,
    temporada_ano: null,
    temporada_estimada: null,
    formato: null,
    duracao_episodio: null,
    estudio: null,
    numero_capitulos: null,
    numero_volumes: null,
    autor: null,
    artista: null,
    demografia: null,
    revista: null,
    publicadora: null,
    publicadora_original: null,
    fonte_original: null,
    desenvolvedor: null,
    plataformas: null,
    modo_jogo: null,
    ...campos,
  };
}

export function item(m: Midia, campos: Partial<ItemLista> = {}): ItemLista {
  return {
    ...m,
    id_lista: `L-${m.id_midia}`,
    status_consumo: 'assistindo',
    progresso_atual: 0,
    progresso_total: null,
    nota_usuario: null,
    favorito: false,
    privado: false,
    comentario: null,
    data_adicao: '2025-01-01T00:00:00',
    data_atualizacao: '2025-01-01T00:00:00',
    data_inicio: null,
    data_conclusao: null,
    ...campos,
  } as ItemLista;
}

export function popular(m: Midia, totalUsuarios = m.total_usuarios): MidiaPopular {
  const { id_midia, titulo_original, titulo_ingles, titulo_romaji, tipo, poster_url, generos, nota_media, nota_fonte, origem_nota } = m;
  return {
    id_midia,
    titulo_original,
    titulo_ingles,
    titulo_romaji,
    tipo,
    poster_url,
    generos,
    nota_media,
    nota_fonte,
    origem_nota,
    total_usuarios: totalUsuarios,
  };
}

/** Uma Sugestão de GET /sugestoes: a Mídia e o motivo (sem motivo, "Em alta"). */
export function sugestao(m: Midia, motivo: Partial<MotivoDaSugestao> = {}): Sugestao {
  return { ...m, motivo: { porque: 'em_alta', nota: null, titulo: null, ...motivo } };
}

const pagina = (itens: Midia[]): Resposta => {
  const corpo: Esquemas['PaginaMidia'] = { itens, pagina: 1, por_pagina: 20, total: itens.length };
  return { status: 200, corpo };
};

type Catalogo = {
  emAlta?: Midia[];
  populares?: MidiaPopular[];
  lista?: ItemLista[];
  /** GET /midias por ordem (e gênero, como `nota_media:Drama`). */
  porOrdem?: Record<string, Midia[]>;
  /** GET /sugestoes; sem `tipo` na query, as de anime e mangá. */
  sugestoes?: Sugestao[];
};

/** Rotas do Início, filtrando cada lista pelo Tipo pedido, como a API. */
export function rotasDoInicio({ emAlta = [], populares = [], lista = [], porOrdem = {}, sugestoes = [] }: Catalogo): Rotas {
  const doTipo = <M extends { tipo: string }>(ms: M[], req: Requisicao) => ms.filter((m) => m.tipo === req.query.get('tipo'));
  return {
    'GET /midias/trending': (req) => ({ status: 200, corpo: { midias: doTipo(emAlta, req) } }),
    'GET /midias/populares': (req) => ({ status: 200, corpo: { midias: doTipo(populares, req) } }),
    'GET /lista': { status: 200, corpo: { lista } },
    'GET /sugestoes': (req) => {
      const tipo = req.query.get('tipo');
      return { status: 200, corpo: { sugestoes: tipo ? sugestoes.filter((s) => s.tipo === tipo) : sugestoes } };
    },
    'GET /midias': (req) => {
      const genero = req.query.get('genero');
      const chave = genero ? `${req.query.get('ordem')}:${genero}` : String(req.query.get('ordem'));
      return pagina(doTipo(porOrdem[chave] ?? [], req));
    },
  };
}
