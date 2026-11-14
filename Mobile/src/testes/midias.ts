// Mídias no formato real de GET /midias/trending, /midias/<id> e /midias/populares
// (conferido contra o backend local). Só os campos que o app lê, mais os nulos
// de outros Tipos, que a API sempre manda.

const vazio = {
  titulo_ingles: null,
  banner_url: null,
  numero_episodios: null,
  status_anime: null,
  estudio: null,
  numero_capitulos: null,
  numero_volumes: null,
  status_manga: null,
  autor: null,
  demografia: null,
  plataformas: null,
  status_jogo: null,
  desenvolvedor: null,
  publicadora: null,
};

export function anime(dados: Record<string, unknown> = {}) {
  return {
    ...vazio,
    id_midia: 'MID-ANM-2026-20053',
    tipo: 'anime',
    tipo_label: 'Anime',
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
    estudio: 'MADHOUSE',
    atualizacoes: [],
    ...dados,
  };
}

export function manga(dados: Record<string, unknown> = {}) {
  return {
    ...vazio,
    id_midia: 'MID-MNG-2026-30001',
    tipo: 'manga',
    tipo_label: 'Mangá',
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
    autor: 'Hirohiko Araki',
    demografia: 'Shounen',
    atualizacoes: [],
    ...dados,
  };
}

export function jogo(dados: Record<string, unknown> = {}) {
  return {
    ...vazio,
    id_midia: 'MID-JOG-2026-40001',
    tipo: 'jogo',
    tipo_label: 'Jogo',
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
    desenvolvedor: 'Team Cherry',
    publicadora: 'Team Cherry',
    atualizacoes: [],
    ...dados,
  };
}

/** Um segundo anime, para listas com mais de uma Mídia do mesmo Tipo. */
export function fullmetal(dados: Record<string, unknown> = {}) {
  return anime({
    id_midia: 'MID-ANM-2026-20011',
    titulo_original: '鋼の錬金術師 FULLMETAL ALCHEMIST',
    titulo_portugues: 'Fullmetal Alchemist: Brotherhood',
    nota_media: 9.0,
    numero_episodios: 64,
    ...dados,
  });
}

/** Item de GET /lista no formato real (conferido contra o backend local): a Mídia mais os campos do Item. */
export function itemDaLista(
  midia: { id_midia: string; tipo: string } & Record<string, unknown>,
  dados: Record<string, unknown> = {},
) {
  return {
    ...midia,
    id_lista: `LST-${midia.id_midia}`,
    codigo_lista: 'LST20261106-00001',
    status_consumo: 'planejado',
    progresso_atual: 0,
    progresso_total: (midia.numero_episodios ?? midia.numero_capitulos ?? null) as number | null,
    nota_usuario: null,
    favorito: false,
    privado: false,
    data_inicio: null,
    data_conclusao: null,
    comentario: null,
    total_rewatches: 0,
    ...dados,
  };
}

/** Linha de vw_midias_populares: subconjunto dos campos, como a API manda (números como número). */
type Fixture = ReturnType<typeof anime> | ReturnType<typeof manga> | ReturnType<typeof jogo>;

export function popular(midia: Fixture, total_usuarios: number) {
  return {
    id_midia: midia.id_midia,
    tipo: midia.tipo,
    tipo_label: midia.tipo_label,
    titulo_original: midia.titulo_original,
    titulo_portugues: midia.titulo_portugues,
    poster_url: midia.poster_url,
    nota_media: midia.nota_media,
    total_usuarios,
    usuarios_concluiram: 0,
    total_favoritos: 0,
    generos: midia.generos,
  };
}
