"""Seed de desenvolvimento (ticket 15): dados fixos para usar o app sem importar nada.

Uso, dentro do container backend: `python -m seed_dev [--recriar]` (ou `make seed-dev`).

Cria, sem tocar em RAWG nem AniList:

- Mídias reais (animes, mangás e jogos) com os `anilist_id`/`rawg_slug` de verdade:
  `make import-*` depois atualiza essas Mídias no lugar em vez de duplicá-las;
- três Usuários de dev (comum, admin e moderador), cada um no seu Grupo;
- a Lista pessoal do Usuário comum com todos os Estados de consumo de cada Tipo,
  gravada pelo módulo de domínio (`ListaPessoal`), que aplica Concluído ⇔ Progresso = total;
- Avaliações de Usuários diferentes (há Nota média), Notícias, Atualizações de mídia e
  as Notificações delas para o Usuário comum, uma lida e outra não.

Idempotente pelas chaves naturais: `anilist_id`/`rawg_slug` da Mídia, e-mail do Usuário,
(Usuário, Mídia) do Item e da Avaliação, (título, autor) da Notícia, (Mídia, tipo, título)
da Atualização. O que já existe fica como está, inclusive uma Mídia que a Importação
atualizou. `--recriar` apaga os três Usuários do seed e o que pertence a eles (Itens,
Avaliações, Notificações, Notícias) e cria de novo; Mídias e dados de outros Usuários ficam.

Recusa rodar com APP_ENV=production.
"""
from __future__ import annotations

import argparse
import os
import sys
from collections import Counter

from werkzeug.security import generate_password_hash

import banco
from dominio.lista_pessoal import ListaPessoal
from importacao.db import salvar_anime, salvar_jogo, salvar_manga
from repositories import ListaRepository, MidiaRepository

# ---------------------------------------------------------------------------
# Dados fixos
# ---------------------------------------------------------------------------

ANIMES = [
    {
        'anilist_id': 154587, 'titulo_original': '葬送のフリーレン', 'titulo_ingles': "Frieren: Beyond Journey's End",
        'titulo_portugues': 'Sousou no Frieren', 'data_lancamento': '2023-09-29', 'nota_fonte': 9.1,
        'status_anime': 'finalizado', 'numero_episodios': 28, 'duracao_episodio': 24, 'estudio': 'Madhouse',
        'fonte_original': 'Manga',
        'sinopse': 'A elfa Frieren sobrevive aos companheiros do grupo de heróis que derrotou o Rei Demônio '
                   'e parte numa nova jornada para entender as pessoas.',
        'generos': ['Aventura', 'Drama', 'Fantasia'],
    },
    {
        'anilist_id': 5114, 'titulo_original': '鋼の錬金術師 FULLMETAL ALCHEMIST',
        'titulo_ingles': 'Fullmetal Alchemist: Brotherhood',
        'titulo_portugues': 'Hagane no Renkinjutsushi: FULLMETAL ALCHEMIST', 'data_lancamento': '2009-04-05',
        'nota_fonte': 9.0, 'status_anime': 'finalizado', 'numero_episodios': 64, 'duracao_episodio': 24,
        'estudio': 'bones', 'fonte_original': 'Manga',
        'sinopse': 'Os irmãos Edward e Alphonse Elric buscam a Pedra Filosofal para recuperar o que perderam '
                   'numa transmutação proibida.',
        'generos': ['Ação', 'Aventura', 'Drama', 'Fantasia'],
    },
    {
        'anilist_id': 9253, 'titulo_original': 'STEINS;GATE', 'titulo_ingles': 'Steins;Gate',
        'titulo_portugues': 'Steins;Gate', 'data_lancamento': '2011-04-06', 'nota_fonte': 8.8,
        'status_anime': 'finalizado', 'numero_episodios': 24, 'duracao_episodio': 24, 'estudio': 'WHITE FOX',
        'fonte_original': 'Visual Novel',
        'sinopse': 'Um cientista autoproclamado descobre um jeito de mandar mensagens ao passado, e cada '
                   'mudança tem um preço.',
        'generos': ['Drama', 'Ficção Científica', 'Mistério'],
    },
    {
        'anilist_id': 16498, 'titulo_original': '進撃の巨人', 'titulo_ingles': 'Attack on Titan',
        'titulo_portugues': 'Shingeki no Kyojin', 'data_lancamento': '2013-04-07', 'nota_fonte': 8.5,
        'status_anime': 'finalizado', 'numero_episodios': 25, 'duracao_episodio': 24, 'estudio': 'WIT STUDIO',
        'fonte_original': 'Manga',
        'sinopse': 'A humanidade vive cercada por muralhas para se proteger dos Titãs, até o dia em que '
                   'uma delas cai.',
        'generos': ['Ação', 'Drama', 'Fantasia', 'Mistério'],
    },
    {
        'anilist_id': 1, 'titulo_original': 'カウボーイビバップ', 'titulo_ingles': 'Cowboy Bebop',
        'titulo_portugues': 'Cowboy Bebop', 'data_lancamento': '1998-04-03', 'nota_fonte': 8.6,
        'status_anime': 'finalizado', 'numero_episodios': 26, 'duracao_episodio': 24, 'estudio': 'Sunrise',
        'fonte_original': 'Original',
        'sinopse': 'Spike Spiegel e a tripulação da nave Bebop caçam recompensas pelo sistema solar em 2071.',
        'generos': ['Ação', 'Aventura', 'Drama', 'Ficção Científica'],
    },
    {
        'anilist_id': 1535, 'titulo_original': 'デスノート', 'titulo_ingles': 'Death Note',
        'titulo_portugues': 'Death Note', 'data_lancamento': '2006-10-04', 'nota_fonte': 8.4,
        'status_anime': 'finalizado', 'numero_episodios': 37, 'duracao_episodio': 23, 'estudio': 'MADHOUSE',
        'fonte_original': 'Manga',
        'sinopse': 'Light Yagami encontra um caderno que mata quem tiver o nome escrito nele e decide '
                   'limpar o mundo do crime.',
        'generos': ['Mistério', 'Sobrenatural'],
    },
]

MANGAS = [
    {
        'anilist_id': 30013, 'titulo_original': 'ONE PIECE', 'titulo_ingles': 'One Piece',
        'titulo_portugues': 'ONE PIECE', 'data_lancamento': '1997-07-22', 'nota_fonte': 9.0,
        'status_manga': 'em_publicacao', 'numero_capitulos': None, 'numero_volumes': None,
        'autor': 'Eiichiro Oda', 'artista': 'Eiichiro Oda', 'publicadora_original': 'Shueisha',
        'revista': 'Weekly Shounen Jump', 'demografia': 'shounen',
        'sinopse': 'Monkey D. Luffy navega com o seu bando atrás do tesouro deixado por Gol D. Roger.',
        'generos': ['Ação', 'Aventura', 'Comédia', 'Fantasia'],
    },
    {
        'anilist_id': 30002, 'titulo_original': 'ベルセルク', 'titulo_ingles': 'Berserk',
        'titulo_portugues': 'Berserk', 'data_lancamento': '1989-08-25', 'nota_fonte': 9.3,
        'status_manga': 'hiato', 'numero_capitulos': None, 'numero_volumes': None,
        'autor': 'Kentarou Miura', 'artista': 'Kentarou Miura', 'publicadora_original': 'Hakusensha',
        'revista': 'Young Animal', 'demografia': 'seinen',
        'sinopse': 'Guts, o Espadachim Negro, vive para se vingar de quem traiu o Bando do Falcão.',
        'generos': ['Ação', 'Aventura', 'Drama', 'Fantasia', 'Terror'],
    },
    {
        'anilist_id': 30001, 'titulo_original': 'MONSTER', 'titulo_ingles': 'Monster',
        'titulo_portugues': 'MONSTER', 'data_lancamento': '1994-12-05', 'nota_fonte': 8.9,
        'status_manga': 'finalizado', 'numero_capitulos': 162, 'numero_volumes': 18,
        'autor': 'Naoki Urasawa', 'artista': 'Naoki Urasawa', 'publicadora_original': 'Shogakukan',
        'revista': 'Big Comic Original', 'demografia': 'seinen',
        'sinopse': 'O neurocirurgião Kenzo Tenma salva um menino e anos depois descobre que ele virou um '
                   'assassino.',
        'generos': ['Drama', 'Mistério'],
    },
    {
        'anilist_id': 30011, 'titulo_original': 'NARUTO -ナルト-', 'titulo_ingles': 'Naruto',
        'titulo_portugues': 'NARUTO', 'data_lancamento': '1999-09-21', 'nota_fonte': 8.0,
        'status_manga': 'finalizado', 'numero_capitulos': 700, 'numero_volumes': 72,
        'autor': 'Masashi Kishimoto', 'artista': 'Masashi Kishimoto', 'publicadora_original': 'Shueisha',
        'revista': 'Weekly Shounen Jump', 'demografia': 'shounen',
        'sinopse': 'Naruto Uzumaki, ninja da Vila da Folha, quer ser reconhecido como Hokage.',
        'generos': ['Ação', 'Aventura', 'Comédia'],
    },
    {
        'anilist_id': 30656, 'titulo_original': 'バガボンド', 'titulo_ingles': 'Vagabond',
        'titulo_portugues': 'Vagabond', 'data_lancamento': '1998-09-03', 'nota_fonte': 9.0,
        'status_manga': 'hiato', 'numero_capitulos': 327, 'numero_volumes': 37,
        'autor': 'Takehiko Inoue, Eiji Yoshikawa', 'artista': 'Takehiko Inoue', 'publicadora_original': 'Kodansha',
        'revista': 'Morning', 'demografia': 'seinen',
        'sinopse': 'A vida do espadachim Miyamoto Musashi, da batalha de Sekigahara em diante.',
        'generos': ['Ação', 'Aventura', 'Drama'],
    },
]

JOGOS = [
    {
        'rawg_slug': 'the-witcher-3-wild-hunt', 'titulo_original': 'The Witcher 3: Wild Hunt',
        'titulo_portugues': 'The Witcher 3: Wild Hunt', 'data_lancamento': '2015-05-18', 'nota_fonte': 9.3,
        'desenvolvedor': 'CD PROJEKT RED', 'publicadora': 'CD PROJEKT RED',
        'plataformas': ['PC', 'PlayStation 4', 'Xbox One', 'Nintendo Switch'], 'status_jogo': 'lancado',
        'modo_jogo': 'single', 'classificacao': 'ESRB: Mature',
        'sinopse': 'Geralt de Rívia procura Ciri, a filha adotiva perseguida pela Caçada Selvagem.',
        'generos': ['Ação', 'Aventura', 'RPG'],
    },
    {
        'rawg_slug': 'hollow-knight', 'titulo_original': 'Hollow Knight', 'titulo_portugues': 'Hollow Knight',
        'data_lancamento': '2017-02-23', 'nota_fonte': 8.8, 'desenvolvedor': 'Team Cherry',
        'publicadora': 'Team Cherry', 'plataformas': ['PC', 'Nintendo Switch', 'PlayStation 4', 'Xbox One'],
        'status_jogo': 'lancado', 'modo_jogo': 'single', 'classificacao': 'ESRB: Everyone 10+',
        'sinopse': 'Um cavaleiro sem nome explora as ruínas do reino subterrâneo de Hallownest.',
        'generos': ['Ação', 'Aventura', 'Plataforma'],
    },
    {
        'rawg_slug': 'elden-ring', 'titulo_original': 'Elden Ring', 'titulo_portugues': 'Elden Ring',
        'data_lancamento': '2022-02-25', 'nota_fonte': 8.8, 'desenvolvedor': 'FromSoftware',
        'publicadora': 'Bandai Namco Entertainment', 'plataformas': ['PC', 'PlayStation 5', 'Xbox Series S/X'],
        'status_jogo': 'lancado', 'modo_jogo': 'ambos', 'classificacao': 'ESRB: Mature',
        'sinopse': 'Um Maculado atravessa as Terras Intermédias para reunir os fragmentos do Anel Prístino.',
        'generos': ['Ação', 'RPG'],
    },
    {
        'rawg_slug': 'celeste', 'titulo_original': 'Celeste', 'titulo_portugues': 'Celeste',
        'data_lancamento': '2018-01-25', 'nota_fonte': 8.4, 'desenvolvedor': 'Maddy Makes Games',
        'publicadora': 'Maddy Makes Games', 'plataformas': ['PC', 'Nintendo Switch', 'PlayStation 4'],
        'status_jogo': 'lancado', 'modo_jogo': 'single', 'classificacao': 'ESRB: Everyone 10+',
        'sinopse': 'Madeline escala a montanha Celeste enquanto enfrenta a própria ansiedade.',
        'generos': ['Plataforma', 'Aventura'],
    },
    {
        'rawg_slug': 'stardew-valley', 'titulo_original': 'Stardew Valley', 'titulo_portugues': 'Stardew Valley',
        'data_lancamento': '2016-02-26', 'nota_fonte': 8.6, 'desenvolvedor': 'ConcernedApe',
        'publicadora': 'ConcernedApe', 'plataformas': ['PC', 'Nintendo Switch', 'Android', 'iOS'],
        'status_jogo': 'lancado', 'modo_jogo': 'ambos', 'classificacao': 'ESRB: Everyone 10+',
        'sinopse': 'Você herda a fazenda do avô em Stardew Valley e recomeça a vida no campo.',
        'generos': ['Simulação'],
    },
    {
        'rawg_slug': 'red-dead-redemption-2', 'titulo_original': 'Red Dead Redemption 2',
        'titulo_portugues': 'Red Dead Redemption 2', 'data_lancamento': '2018-10-26', 'nota_fonte': 9.2,
        'desenvolvedor': 'Rockstar Games', 'publicadora': 'Rockstar Games',
        'plataformas': ['PC', 'PlayStation 4', 'Xbox One'], 'status_jogo': 'lancado', 'modo_jogo': 'ambos',
        'classificacao': 'ESRB: Mature',
        'sinopse': 'Arthur Morgan e a gangue de Dutch van der Linde fogem da lei no fim do Velho Oeste.',
        'generos': ['Ação', 'Aventura'],
    },
]

#: tipo -> (lista de Mídias, chave da fonte, função que grava como a Importação)
CATALOGO = {
    'anime': (ANIMES, 'anilist_id', salvar_anime),
    'manga': (MANGAS, 'anilist_id', salvar_manga),
    'jogo': (JOGOS, 'rawg_slug', salvar_jogo),
}
_TABELA = {'anime': 'animes', 'manga': 'mangas', 'jogo': 'jogos'}

TESTE = 'teste@medialist.dev'
ADMIN = 'admin@medialist.dev'
MODERADOR = 'moderador@medialist.dev'

#: e-mail -> (nome, senha, Grupo)
USUARIOS = {
    TESTE: ('Usuário de Teste', 'teste123', 'Usuários'),
    ADMIN: ('Admin de Dev', 'admin123', 'Administradores'),
    MODERADOR: ('Moderador de Dev', 'moderador123', 'Moderadores'),
}

#: Lista pessoal do Usuário comum: ((tipo, chave da fonte), payload do Item). Cobre todos
#: os Estados de consumo de cada Tipo. Em jogo, `progresso_atual` são horas jogadas.
ITENS_DO_TESTE = [
    # Anime
    (('anime', 154587), {'status_consumo': 'assistindo', 'progresso_atual': 14, 'favorito': True,
                         'data_inicio': '2025-10-01', 'comentario': 'Assistindo um por semana.'}),
    (('anime', 5114), {'status_consumo': 'completo', 'nota_usuario': 10, 'favorito': True,
                       'total_rewatches': 2, 'data_inicio': '2024-01-05', 'data_conclusao': '2024-03-20'}),
    # Progresso no total: o domínio promove a Completo e grava a data de conclusão.
    (('anime', 1535), {'status_consumo': 'assistindo', 'progresso_atual': 37, 'nota_usuario': 8.5,
                       'data_inicio': '2025-06-01'}),
    (('anime', 9253), {'status_consumo': 'pausado', 'progresso_atual': 9, 'nota_usuario': 8,
                       'data_inicio': '2025-02-10'}),
    (('anime', 16498), {'status_consumo': 'abandonado', 'progresso_atual': 5, 'privado': True,
                        'data_inicio': '2024-08-01'}),
    (('anime', 1), {'status_consumo': 'planejado'}),
    # Mangá
    (('manga', 30013), {'status_consumo': 'lendo', 'progresso_atual': 1100, 'favorito': True,
                        'nota_usuario': 9.5, 'data_inicio': '2020-03-15'}),
    (('manga', 30002), {'status_consumo': 'pausado', 'progresso_atual': 250, 'data_inicio': '2023-05-02'}),
    (('manga', 30001), {'status_consumo': 'lido', 'nota_usuario': 9, 'total_rewatches': 1,
                        'data_inicio': '2022-01-10', 'data_conclusao': '2022-04-28'}),
    (('manga', 30011), {'status_consumo': 'abandonado', 'progresso_atual': 450, 'nota_usuario': 6.5}),
    (('manga', 30656), {'status_consumo': 'planejado', 'privado': True}),
    # Jogo (horas jogadas, sem Progresso)
    (('jogo', 'the-witcher-3-wild-hunt'), {'status_consumo': 'platinado', 'progresso_atual': 180,
                                           'nota_usuario': 10, 'favorito': True, 'data_inicio': '2023-01-02',
                                           'data_conclusao': '2023-06-30'}),
    (('jogo', 'hollow-knight'), {'status_consumo': 'zerado', 'progresso_atual': 45, 'nota_usuario': 9,
                                 'total_rewatches': 1, 'data_inicio': '2024-02-01',
                                 'data_conclusao': '2024-03-10'}),
    (('jogo', 'elden-ring'), {'status_consumo': 'jogando', 'progresso_atual': 60, 'data_inicio': '2025-09-12'}),
    (('jogo', 'celeste'), {'status_consumo': 'pausado', 'progresso_atual': 8}),
    (('jogo', 'stardew-valley'), {'status_consumo': 'abandonado', 'progresso_atual': 12, 'privado': True}),
    (('jogo', 'red-dead-redemption-2'), {'status_consumo': 'na_fila'}),
]

#: (autor, (tipo, chave da fonte), nota, título, texto)
AVALIACOES = [
    (TESTE, ('anime', 5114), 9.0, 'Quase perfeito',
     'Final amarrado, personagens que crescem de verdade. Só o ritmo do começo cansa.'),
    (ADMIN, ('anime', 5114), 10.0, 'Obra-prima',
     'A melhor adaptação de mangá que já vi. Nenhum episódio sobrando.'),
    (MODERADOR, ('anime', 5114), 9.5, 'Referência do gênero',
     'Ação, drama e um vilão à altura. Recomendo para quem está começando em anime.'),
    (ADMIN, ('jogo', 'the-witcher-3-wild-hunt'), 10.0, 'RPG de mundo aberto definitivo',
     'Missões secundárias melhores que a história principal de muito jogo.'),
    (MODERADOR, ('jogo', 'the-witcher-3-wild-hunt'), 8.5, 'Ótimo, mas longo',
     'Combate é o ponto fraco; a escrita compensa.'),
]

#: Publicadas pelo admin: (título, conteúdo, categoria, tags)
NOTICIAS = [
    ('Bem-vindo ao MediaList de desenvolvimento',
     'Estes dados vêm do seed de desenvolvimento (make seed-dev). Rode make import-* para o Catálogo completo.',
     'geral', ['medialist', 'dev']),
    ('Temporada de outono: o que assistir',
     'Uma seleção das estreias da temporada para pôr na sua Lista pessoal.',
     'anime', ['anime', 'temporada']),
]

#: Atualizações de mídia notificadas ao Usuário comum: ((tipo, chave), tipo, título, descrição, lida)
ATUALIZACOES = [
    (('anime', 154587), 'episodio', 'Episódio 15 disponível', 'Novo episódio de Sousou no Frieren.', False),
    (('manga', 30013), 'capitulo', 'Capítulo 1101 disponível', 'Novo capítulo de ONE PIECE.', True),
]


# ---------------------------------------------------------------------------
# Gravação
# ---------------------------------------------------------------------------

class Relatorio:
    """Contagem de criados e já existentes por entidade, para a saída do terminal."""

    #: Entidade -> particípio concordando com ela, na ordem em que o seed grava.
    ENTIDADES = {
        'Mídias': 'criadas', 'Usuários': 'criados', 'Itens de lista': 'criados', 'Avaliações': 'criadas',
        'Notícias': 'criadas', 'Atualizações de mídia': 'criadas', 'Notificações': 'criadas',
    }

    def __init__(self):
        self.criados: Counter[str] = Counter()
        self.existentes: Counter[str] = Counter()
        self.apagados = 0

    def contar(self, entidade: str, criado: bool) -> None:
        (self.criados if criado else self.existentes)[entidade] += 1

    def linhas(self) -> list[str]:
        linhas = [
            f'  {e}: {self.criados[e]} {criadas}, {self.existentes[e]} já existiam'
            for e, criadas in self.ENTIDADES.items()
        ]
        if self.apagados:
            linhas.insert(0, f'  --recriar: {self.apagados} Usuários do seed apagados com o que era deles')
        return linhas


def _id_da_midia(tipo: str, chave: object) -> str | None:
    _, campo, _ = CATALOGO[tipo]
    linha = banco.consultar_um(f'SELECT id_midia FROM {_TABELA[tipo]} WHERE {campo} = %s', (chave,))
    return linha['id_midia'] if linha else None


def _semear_midias(rel: Relatorio) -> dict[tuple[str, object], str]:
    """Grava pela Importação só as Mídias que faltam; as existentes ficam como estão."""
    ids = {}
    for tipo, (midias, campo, salvar) in CATALOGO.items():
        for midia in midias:
            chave = midia[campo]
            id_midia = _id_da_midia(tipo, chave)
            rel.contar('Mídias', id_midia is None)
            if id_midia is None:
                dados = {k: v for k, v in midia.items() if k != 'generos'}
                id_midia = salvar(dados, midia['generos'])['id_midia']
            ids[(tipo, chave)] = id_midia
    return ids


def _semear_usuarios(rel: Relatorio) -> dict[str, str]:
    ids = {}
    for email, (nome, senha, grupo) in USUARIOS.items():
        with banco.transacao() as t:
            criado = t.consultar_um(
                'INSERT INTO usuarios (nome_completo, email, senha_hash) VALUES (%s, %s, %s) '
                'ON CONFLICT (email) DO NOTHING RETURNING id_usuario',
                (nome, email, generate_password_hash(senha)),
            )
            id_usuario = (criado or t.consultar_um(
                'SELECT id_usuario FROM usuarios WHERE email = %s', (email,)))['id_usuario']
            t.executar(
                'INSERT INTO usuarios_grupos (id_usuario, id_grupo) '
                'SELECT %s, id_grupo FROM grupos_usuarios WHERE nome_grupo = %s ON CONFLICT DO NOTHING',
                (id_usuario, grupo),
            )
        rel.contar('Usuários', criado is not None)
        ids[email] = id_usuario
    return ids


def _semear_itens(rel: Relatorio, id_teste: str, midias: dict) -> None:
    lista_repository = ListaRepository()
    lista = ListaPessoal(lista_repository, MidiaRepository())
    for midia, payload in ITENS_DO_TESTE:
        id_midia = midias[midia]
        if lista_repository.obter_item_usuario(id_teste, id_midia):
            rel.contar('Itens de lista', False)
            continue
        resultado = lista.adicionar(id_teste, {**payload, 'id_midia': id_midia})
        if not resultado.bem_sucedido:
            raise RuntimeError(f'Item do seed recusado pelo domínio ({midia}): {resultado.detalhes}')
        rel.contar('Itens de lista', True)


def _semear_avaliacoes(rel: Relatorio, usuarios: dict, midias: dict) -> None:
    for email, midia, nota, titulo, texto in AVALIACOES:
        criada = banco.consultar_um(
            'INSERT INTO avaliacoes (id_usuario, id_midia, nota, titulo_avaliacao, texto_avaliacao) '
            'VALUES (%s, %s, %s, %s, %s) ON CONFLICT (id_usuario, id_midia) DO NOTHING RETURNING id_avaliacao',
            (usuarios[email], midias[midia], nota, titulo, texto),
        )
        rel.contar('Avaliações', criada is not None)


def _semear_noticias(rel: Relatorio, id_autor: str) -> None:
    for titulo, conteudo, categoria, tags in NOTICIAS:
        criada = banco.consultar_um(
            'INSERT INTO noticias (titulo, conteudo, id_autor, categoria, tags) '
            'SELECT %(titulo)s, %(conteudo)s, %(autor)s, %(categoria)s, %(tags)s '
            'WHERE NOT EXISTS (SELECT 1 FROM noticias WHERE titulo = %(titulo)s AND id_autor = %(autor)s) '
            'RETURNING id_noticia',
            {'titulo': titulo, 'conteudo': conteudo, 'autor': id_autor, 'categoria': categoria, 'tags': tags},
        )
        rel.contar('Notícias', criada is not None)


def _semear_atualizacoes(rel: Relatorio, id_teste: str, midias: dict) -> None:
    for midia, tipo, titulo, descricao, lida in ATUALIZACOES:
        chave = {'midia': midias[midia], 'tipo': tipo, 'titulo': titulo, 'descricao': descricao}
        with banco.transacao() as t:
            existente = t.consultar_um(
                'SELECT id_atualizacao FROM atualizacoes_midia '
                'WHERE id_midia = %(midia)s AND tipo_atualizacao = %(tipo)s AND titulo = %(titulo)s',
                chave,
            )
            id_atualizacao = (existente or t.consultar_um(
                'INSERT INTO atualizacoes_midia (id_midia, tipo_atualizacao, titulo, descricao) '
                'VALUES (%(midia)s, %(tipo)s, %(titulo)s, %(descricao)s) RETURNING id_atualizacao',
                chave,
            ))['id_atualizacao']
            notificada = t.consultar_um(
                'INSERT INTO notificacoes (id_usuario, id_atualizacao, lida) VALUES (%s, %s, %s) '
                'ON CONFLICT (id_usuario, id_atualizacao) DO NOTHING RETURNING id_notificacao',
                (id_teste, id_atualizacao, lida),
            )
        rel.contar('Atualizações de mídia', existente is None)
        rel.contar('Notificações', notificada is not None)


def _apagar_dados_do_seed() -> int:
    """Apaga os Usuários do seed; o CASCADE leva Itens, Avaliações, Notificações e grupos.
    As Notícias deles saem antes: a FK do autor é SET NULL, e elas ficariam órfãs."""
    with banco.transacao() as t:
        t.executar(
            'DELETE FROM noticias WHERE id_autor IN (SELECT id_usuario FROM usuarios WHERE email = ANY(%s))',
            (list(USUARIOS),),
        )
        return t.executar('DELETE FROM usuarios WHERE email = ANY(%s)', (list(USUARIOS),))


def semear(recriar: bool = False) -> Relatorio:
    rel = Relatorio()
    if recriar:
        rel.apagados = _apagar_dados_do_seed()
    midias = _semear_midias(rel)
    usuarios = _semear_usuarios(rel)
    _semear_itens(rel, usuarios[TESTE], midias)
    _semear_avaliacoes(rel, usuarios, midias)
    _semear_noticias(rel, usuarios[ADMIN])
    _semear_atualizacoes(rel, usuarios[TESTE], midias)
    return rel


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog='python -m seed_dev', description='Seed de desenvolvimento.')
    parser.add_argument('--recriar', action='store_true',
                        help='apaga e recria os Usuários do seed e o que é deles (as Mídias ficam)')
    args = parser.parse_args(argv)

    if os.getenv('APP_ENV', 'development') == 'production':
        print('seed_dev: recusado em produção (APP_ENV=production); o seed é só para desenvolvimento.',
              file=sys.stderr)
        return 1

    rel = semear(recriar=args.recriar)
    print('Seed de desenvolvimento:')
    print('\n'.join(rel.linhas()))
    print('Credenciais de dev:')
    for email, (_, senha, grupo) in USUARIOS.items():
        print(f'  {email} / {senha} ({grupo})')
    return 0


if __name__ == '__main__':
    sys.exit(main())
