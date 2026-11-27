"""Catálogo e Lista pessoal (persistência) contra o PostgreSQL real.

O que os testes de rota, que trocam esses módulos, não alcançam: o SQL de verdade.
Usa TEST_DATABASE_URL (usuário da aplicação, schema migrado); sem ela, pula.
Cada teste apaga o que gravou.
"""
import os
import uuid
from decimal import Decimal

import pytest

import banco
from decorators import nivel_de_acesso
from repositories import Catalogo, ItensLista
from routes.usuario import ESTATISTICAS_POR_TIPO

from .helpers import criar_usuario as _usuario  # noqa: F401 (outros testes importam daqui)

TEST_DATABASE_URL = os.getenv('TEST_DATABASE_URL')

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para os repositórios'
)


def _midia(pg, tipo, **dados):
    id_midia = Catalogo().criar(tipo, {'titulo_original': f'PG {uuid.uuid4().hex}', **dados})
    pg['midias'].append(id_midia)
    return id_midia


def test_midia_criada_sai_com_notas_nulas_e_plataformas_em_texto(pg):
    acao = banco.consultar_um("SELECT id_genero FROM generos WHERE nome_genero = 'Ação'")['id_genero']
    id_jogo = _midia(pg, 'jogo', plataformas='PC, Switch', generos=[acao], data_lancamento='2024-05-01')

    jogo = Catalogo().obter(id_jogo)

    assert jogo['tipo'] == 'jogo'
    assert jogo['nota_media'] is None and jogo['total_avaliacoes'] is None
    assert jogo['plataformas'] == 'PC, Switch'
    assert jogo['generos_lista'] == ['Ação']
    assert str(jogo['data_lancamento']) == '2024-05-01'


@pytest.mark.parametrize(
    'ordem',
    ['nota_media', 'data_lancamento', 'titulo', 'mais_adicionados', 'popularidade', 'mais_concluidos'],
)
def test_listagem_com_todos_os_filtros_roda_no_postgres(pg, ordem):
    id_jogo = _midia(pg, 'jogo', plataformas='PC, Switch', desenvolvedor='Nintendo EPD', modo_jogo='single')

    filtros = {
        'busca': 'pg ', 'plataforma': 'Switch', 'desenvolvedor': 'nintendo', 'modo_jogo': 'single',
        'status': 'lancado', 'ordem': ordem,
    }
    resultado = Catalogo().buscar('jogo', pagina=1, limite=50, filtros=filtros)

    assert id_jogo in [m['id_midia'] for m in resultado]
    # Plataforma casa o elemento inteiro, não substring.
    parcial = Catalogo().buscar('jogo', limite=50, filtros={'plataforma': 'Swi'})
    assert id_jogo not in [m['id_midia'] for m in parcial]
    sem_tipo = {'busca': 'x', 'status': 'lancado', 'autor': 'a', 'estudio': 'b', 'demografia': 'seinen',
                'artista': 'c', 'genero': 'Ação', 'ordem': ordem}
    assert Catalogo().buscar(None, pagina=2, limite=5, filtros=sem_tipo) == []


def test_mais_concluidos_ordena_por_itens_em_concluido_ou_platinado(pg):
    marca = uuid.uuid4().hex
    um_concluido = _midia(pg, 'jogo', titulo_original=f'{marca} um')
    dois_concluidos = _midia(pg, 'jogo', titulo_original=f'{marca} dois')
    so_jogando = _midia(pg, 'jogo', titulo_original=f'{marca} jogando')
    ana, bia, caio = _usuario(pg), _usuario(pg), _usuario(pg)
    repo = ItensLista()
    repo.criar_item(ana, um_concluido, {'status_consumo': 'zerado'})
    repo.criar_item(ana, dois_concluidos, {'status_consumo': 'platinado'})
    repo.criar_item(bia, dois_concluidos, {'status_consumo': 'zerado'})
    for usuario in (ana, bia, caio):
        repo.criar_item(usuario, so_jogando, {'status_consumo': 'jogando'})

    resultado = Catalogo().buscar('jogo', limite=50, filtros={'busca': marca, 'ordem': 'mais_concluidos'})

    assert [m['id_midia'] for m in resultado] == [dois_concluidos, um_concluido, so_jogando]
    assert [m['total_concluidos'] for m in resultado] == [2, 1, 0]


def test_nota_media_vem_das_avaliacoes_e_ordena_com_nulls_last(pg):
    avaliada = _midia(pg, 'anime', numero_episodios=12)
    sem_nota = _midia(pg, 'anime', numero_episodios=12)
    usuario = _usuario(pg)
    banco.executar(
        'INSERT INTO avaliacoes (id_usuario, id_midia, nota) VALUES (%s, %s, 10)', (usuario, avaliada)
    )

    midia = Catalogo().obter(avaliada)
    assert midia['nota_media'] == Decimal('10.00') and midia['total_avaliacoes'] == 1

    listagem = Catalogo().buscar('anime', limite=50, filtros={'ordem': 'nota_media'})
    ids = [m['id_midia'] for m in listagem]
    if sem_nota in ids:
        assert ids.index(avaliada) < ids.index(sem_nota)


def test_item_copia_o_total_da_midia_e_nao_duplica(pg):
    anime = _midia(pg, 'anime', numero_episodios=12)
    jogo = _midia(pg, 'jogo')
    usuario = _usuario(pg)
    repo = ItensLista()

    id_lista = repo.criar_item(usuario, anime, {'status_consumo': 'assistindo', 'favorito': 1})
    id_jogo = repo.criar_item(usuario, jogo, {'status_consumo': 'jogando'})

    assert uuid.UUID(id_lista)
    item = repo.obter_item_por_id(id_lista)
    assert item['progresso_total'] == 12 and item['progresso_total_padrao'] == 12
    assert item['id_usuario'] == usuario
    assert repo.obter_item_por_id(id_jogo)['progresso_total'] is None
    assert repo.criar_item(usuario, anime, {'status_consumo': 'planejado'}) is None

    assert repo.atualizar_campos(id_lista, {'progresso_atual': 12, 'status_consumo': 'completo', 'nota_usuario': None})
    lista = repo.listar(usuario)
    assert {i['id_lista'] for i in lista} == {id_lista, id_jogo}

    estatisticas = banco.consultar(ESTATISTICAS_POR_TIPO, (usuario,))
    assert [(e['tipo'], e['total_midias'], e['concluidos'], e['favoritos']) for e in estatisticas] == [
        ('anime', 1, 1, 1), ('jogo', 1, 0, 0),
    ]

    assert repo.remover_item(id_lista, usuario) is True
    assert repo.remover_item(id_lista, usuario) is False


def test_nivel_de_acesso_vem_da_coluna_e_usuario_inexistente_e_usuario(pg):
    assert nivel_de_acesso(_usuario(pg, 'admin')) == 'admin'
    assert nivel_de_acesso(_usuario(pg)) == 'usuario'
    assert nivel_de_acesso(str(uuid.uuid4())) == 'usuario'


def test_atualizar_e_deletar_midia(pg):
    id_manga = _midia(pg, 'manga', numero_capitulos=10, autor='Urasawa')
    repo = Catalogo()

    assert repo.atualizar(id_manga, {'titulo_romaji': 'Monstro', 'numero_capitulos': 162, 'generos': []})
    manga = repo.obter(id_manga)
    assert manga['titulo_romaji'] == 'Monstro' and manga['progresso_total_padrao'] == 162
    assert repo.buscar('manga', filtros={'autor': 'urasawa'})

    assert repo.apagar(id_manga) is True
    assert repo.apagar(id_manga) is False



def test_generos_casam_o_tipo_inteiro_e_populares_e_distribuicao_rodam(pg):
    anime = _midia(pg, 'anime', numero_episodios=3)
    usuario = _usuario(pg)
    ItensLista().criar_item(usuario, anime, {'status_consumo': 'assistindo'})
    catalogo = Catalogo()

    assert catalogo.generos('nim') == []
    assert {'anime'} <= {t for g in catalogo.generos('anime') for t in g['aplicavel_a']}
    assert len(catalogo.generos()) >= len(catalogo.generos('jogo'))
    assert all(m['tipo'] == 'jogo' for m in catalogo.populares('jogo'))
    assert len(catalogo.populares()) <= 20
    assert catalogo.distribuicao(anime) == [{'status_consumo': 'assistindo', 'total': 1}]


def test_populares_trazem_os_tres_titulos(pg):
    # Usuários bastantes para a Mídia entrar entre as 20 mais populares de anime.
    id_midia = _midia(
        pg, 'anime', titulo_ingles='Fullmetal Alchemist: Brotherhood', titulo_romaji='Hagane no Renkinjutsushi',
    )
    for _ in range(30):
        ItensLista().criar_item(_usuario(pg), id_midia, {'status_consumo': 'assistindo'})

    [popular] = [m for m in Catalogo().populares('anime') if m['id_midia'] == id_midia]

    assert popular['titulo_ingles'] == 'Fullmetal Alchemist: Brotherhood'
    assert popular['titulo_romaji'] == 'Hagane no Renkinjutsushi'


def test_lista_em_ordem_alfabetica_do_titulo_exibido(pg):
    """Título exibido = romanizado (jogo: o nome), senão original; sem caixa; editar não muda a posição."""
    usuario = _usuario(pg)
    itens = ItensLista()
    titulos = [('banana', 'Z'), (None, 'Celeste'), ('', 'Akira'), ('Banana', 'A')]
    ids = {}
    for romaji, original in titulos:
        id_midia = _midia(pg, 'jogo', titulo_original=original, titulo_romaji=romaji)
        ids[original] = itens.criar_item(usuario, id_midia, {'status_consumo': 'jogando'})

    ordem = [i['titulo_romaji'] or i['titulo_original'] for i in itens.listar(usuario)]

    assert [o.casefold() for o in ordem] == ['akira', 'banana', 'banana', 'celeste']
    bananas = sorted([ids['Z'], ids['A']])
    assert [i['id_lista'] for i in itens.listar(usuario)][1:3] == bananas


def test_item_grava_so_colunas_conhecidas_e_nota_vazia_apaga(pg):
    anime = _midia(pg, 'anime', numero_episodios=12)
    usuario = _usuario(pg)
    itens = ItensLista()

    id_lista = itens.criar_item(usuario, anime, {
        'status_consumo': 'assistindo', 'nota_usuario': 7.5, 'progresso_total': 99, 'campo_invalido': 'x',
    })
    assert itens.atualizar_campos(id_lista, {'campo_invalido': 1}) is False
    assert itens.atualizar_campos(id_lista, {'nota_usuario': '', 'privado': 1, 'progresso_total': 99})

    [item] = itens.listar(usuario)
    assert (item['nota_usuario'], item['privado'], item['progresso_total']) == (None, True, 12)
    assert itens.obter_item_usuario(usuario, anime)['id_lista'] == id_lista
    assert itens.listar(usuario, tipo='jogo') == [] and itens.listar(usuario, status='completo') == []
