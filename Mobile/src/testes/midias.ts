// Mídias no formato de GET /midias, /midias/trending, /midias/<id> e /midias/populares,
// tipadas pelo contrato gerado (contrato/api.d.ts): um campo que sai ou muda na API
// quebra o `tsc` aqui, não só em produção.

import type { ItemLista, MidiaDetalhe, MidiaPopular } from '../api/tipos';

/** Os campos de todos os Tipos, nulos: a API sempre manda os de outro Tipo vazios. */
const vazio = {
  titulo_ingles: null,
  banner_url: null,
  trailer_url: null,
  classificacao: null,
  classificacao_etaria: null,
  fonte_original: null,
  nota_fonte: null,
  origem_nota: null,
  total_concluidos: 0,
  numero_episodios: null,
  duracao_episodio: null,
  status_anime: null,
  estudio: null,
  numero_capitulos: null,
  numero_volumes: null,
  status_manga: null,
  autor: null,
  artista: null,
  demografia: null,
  publicadora_original: null,
  revista: null,
  plataformas: null,
  status_jogo: null,
  desenvolvedor: null,
  publicadora: null,
  modo_jogo: null,
  atualizacoes: [],
} satisfies Partial<MidiaDetalhe>;

export function anime(dados: Partial<MidiaDetalhe> = {}): MidiaDetalhe {
  return {
    ...vazio,
    id_midia: 'MID-ANM-2026-20053',
    tipo: 'anime',
    titulo_original: '葬送のフリーレン',
    titulo_portugues: 'Sousou no Frieren',
    sinopse: 'A aventura acabou, mas a vida continua para uma maga elfa.',
    data_lancamento: '2023-09-29',
    poster_url: 'https://img.exemplo/frieren.jpg',
    nota_media: 9.1,
    total_avaliacoes: 3,
    total_usuarios: 5,
    generos: 'Aventura, Drama, Fantasia',
    generos_lista: ['Aventura', 'Drama', 'Fantasia'],
    numero_episodios: 28,
    status_anime: 'finalizado',
    status_catalogo: 'finalizado',
    estudio: 'MADHOUSE',
    ...dados,
  };
}

export function manga(dados: Partial<MidiaDetalhe> = {}): MidiaDetalhe {
  return {
    ...vazio,
    id_midia: 'MID-MNG-2026-30001',
    tipo: 'manga',
    titulo_original: 'ジョジョの奇妙な冒険',
    titulo_portugues: 'JoJo no Kimyou na Bouken',
    sinopse: 'Jotaro enfrenta Dio.',
    data_lancamento: '2004-01-19',
    poster_url: 'https://img.exemplo/jojo.jpg',
    nota_media: 9.2,
    total_avaliacoes: 2,
    total_usuarios: 1,
    generos: 'Ação, Aventura',
    generos_lista: ['Ação', 'Aventura'],
    numero_capitulos: 95,
    numero_volumes: 24,
    status_manga: 'finalizado',
    status_catalogo: 'finalizado',
    autor: 'Hirohiko Araki',
    demografia: 'shounen',
    ...dados,
  };
}

export function jogo(dados: Partial<MidiaDetalhe> = {}): MidiaDetalhe {
  return {
    ...vazio,
    id_midia: 'MID-JOG-2026-40001',
    tipo: 'jogo',
    titulo_original: 'Hollow Knight',
    titulo_portugues: null,
    sinopse: 'Um cavaleiro desce a Hallownest.',
    data_lancamento: '2017-02-24',
    poster_url: 'https://img.exemplo/hk.jpg',
    nota_media: 9.0,
    total_avaliacoes: 1,
    total_usuarios: 2,
    generos: 'Ação, Aventura',
    generos_lista: ['Ação', 'Aventura'],
    plataformas: 'PC, Switch, PS4',
    status_jogo: 'lancado',
    status_catalogo: 'lancado',
    desenvolvedor: 'Team Cherry',
    publicadora: 'Team Cherry',
    ...dados,
  };
}

/** Um segundo anime, para listas com mais de uma Mídia do mesmo Tipo. */
export function fullmetal(dados: Partial<MidiaDetalhe> = {}): MidiaDetalhe {
  return anime({
    id_midia: 'MID-ANM-2026-20011',
    titulo_original: '鋼の錬金術師 FULLMETAL ALCHEMIST',
    titulo_portugues: 'Fullmetal Alchemist: Brotherhood',
    nota_media: 9.0,
    numero_episodios: 64,
    ...dados,
  });
}

/** Item de GET /lista: a parte da Mídia que o Item traz mais os campos do Item. */
export function itemDaLista(midia: MidiaDetalhe, dados: Partial<ItemLista> = {}): ItemLista {
  const total = midia.tipo === 'anime' ? midia.numero_episodios : midia.tipo === 'manga' ? midia.numero_capitulos : null;
  return {
    id_midia: midia.id_midia,
    tipo: midia.tipo,
    titulo_original: midia.titulo_original,
    titulo_portugues: midia.titulo_portugues,
    titulo_ingles: midia.titulo_ingles,
    sinopse: midia.sinopse,
    data_lancamento: midia.data_lancamento,
    poster_url: midia.poster_url,
    banner_url: midia.banner_url,
    nota_media: midia.nota_media,
    nota_fonte: midia.nota_fonte,
    origem_nota: midia.origem_nota,
    total_avaliacoes: midia.total_avaliacoes,
    total_usuarios: midia.total_usuarios,
    total_concluidos: midia.total_concluidos,
    generos: midia.generos,
    generos_lista: midia.generos_lista,
    fonte_original: midia.fonte_original,
    status_catalogo: midia.status_catalogo,
    numero_episodios: midia.numero_episodios,
    status_anime: midia.status_anime,
    estudio: midia.estudio,
    numero_capitulos: midia.numero_capitulos,
    numero_volumes: midia.numero_volumes,
    status_manga: midia.status_manga,
    autor: midia.autor,
    demografia: midia.demografia,
    plataformas: midia.plataformas,
    status_jogo: midia.status_jogo,
    desenvolvedor: midia.desenvolvedor,
    publicadora: midia.publicadora,
    modo_jogo: midia.modo_jogo,
    id_lista: `LST-${midia.id_midia}`,
    status_consumo: 'planejado',
    progresso_atual: 0,
    progresso_total: total,
    nota_usuario: null,
    favorito: false,
    privado: false,
    data_inicio: null,
    data_conclusao: null,
    comentario: null,
    total_rewatches: 0,
    data_adicao: '2026-11-01T10:00:00Z',
    data_atualizacao: '2026-11-01T10:00:00Z',
    ...dados,
  };
}

/** Linha de vw_midias_populares: subconjunto dos campos da Mídia. */
export function popular(midia: MidiaDetalhe, total_usuarios: number): MidiaPopular {
  return {
    id_midia: midia.id_midia,
    tipo: midia.tipo,
    titulo_original: midia.titulo_original,
    titulo_portugues: midia.titulo_portugues,
    poster_url: midia.poster_url,
    nota_media: midia.nota_media,
    nota_fonte: midia.nota_fonte,
    origem_nota: midia.origem_nota,
    total_usuarios,
    generos: midia.generos,
  };
}
