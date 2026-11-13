"""SQL dos repositórios e das consultas das rotas contra o PostgreSQL real.

Pega o que os testes com FakeBanco não pegam: SQL que o PostgreSQL recusa.
Usa TEST_DATABASE_URL (usuário da aplicação, schema migrado); sem ela, pula.
Cada teste apaga o que gravou.
"""
import os
import uuid
from decimal import Decimal

import pytest

import banco
from decorators import get_user_permissions
from repositories import ListaRepository, MidiaRepository
from routes.usuario import ESTATISTICAS_POR_TIPO

TEST_DATABASE_URL = os.getenv('TEST_DATABASE_URL')

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para os repositórios'
)


@pytest.fixture
def pg(monkeypatch):
    banco.fechar()
    monkeypatch.setattr(banco, 'database_url', lambda: TEST_DATABASE_URL)
    criados = {'midias': [], 'usuarios': []}
    yield criados
    if criados['midias']:
        banco.executar('DELETE FROM midias WHERE id_midia = ANY(%s::uuid[])', (criados['midias'],))
    if criados['usuarios']:
        banco.executar('DELETE FROM usuarios WHERE id_usuario = ANY(%s::uuid[])', (criados['usuarios'],))
    banco.fechar()


def _usuario(pg, grupo='Usuários'):
    with banco.transacao() as t:
        id_usuario = t.consultar_um(
            "INSERT INTO usuarios (nome_completo, email, senha_hash) VALUES ('PG', %s, 'x') RETURNING id_usuario",
            (f'pg-{uuid.uuid4().hex}@exemplo.test',),
        )['id_usuario']
        t.executar(
            "INSERT INTO usuarios_grupos (id_usuario, id_grupo) "
            "SELECT %s, id_grupo FROM grupos_usuarios WHERE nome_grupo = %s",
            (id_usuario, grupo),
        )
    pg['usuarios'].append(id_usuario)
    return id_usuario


def _midia(pg, tipo, **dados):
    id_midia = MidiaRepository().inserir_midia_base(tipo, {'titulo_original': f'PG {uuid.uuid4().hex}', **dados})
    pg['midias'].append(id_midia)
    return id_midia


def test_midia_criada_sai_com_notas_nulas_e_plataformas_em_texto(pg):
    acao = banco.consultar_um("SELECT id_genero FROM generos WHERE nome_genero = 'Ação'")['id_genero']
    id_jogo = _midia(pg, 'jogo', plataformas='PC, Switch', generos=[acao], data_lancamento='2024-05-01')

    jogo = MidiaRepository().buscar_por_id(id_jogo)

    assert jogo['tipo'] == 'jogo'
    assert jogo['nota_media'] is None and jogo['total_avaliacoes'] is None
    assert jogo['plataformas'] == 'PC, Switch'
    assert jogo['generos_lista'] == ['Ação']
    assert str(jogo['data_lancamento']) == '2024-05-01'


@pytest.mark.parametrize('ordem', ['nota_media', 'data_lancamento', 'titulo', 'mais_adicionados', 'popularidade'])
def test_listagem_com_todos_os_filtros_roda_no_postgres(pg, ordem):
    id_jogo = _midia(pg, 'jogo', plataformas='PC, Switch', desenvolvedor='Nintendo EPD', modo_jogo='single')

    filtros = {
        'busca': 'pg ', 'plataforma': 'Switch', 'desenvolvedor': 'nintendo', 'modo_jogo': 'single',
        'status': 'lancado', 'ordem': ordem,
    }
    resultado = MidiaRepository().buscar_por_tipo('jogo', pagina=1, limite=50, filtros=filtros)

    assert id_jogo in [m['id_midia'] for m in resultado]
    # Plataforma casa o elemento inteiro, não substring.
    parcial = MidiaRepository().buscar_por_tipo('jogo', limite=50, filtros={'plataforma': 'Swi'})
    assert id_jogo not in [m['id_midia'] for m in parcial]
    sem_tipo = {'busca': 'x', 'status': 'lancado', 'autor': 'a', 'estudio': 'b', 'demografia': 'seinen',
                'artista': 'c', 'genero': 'Ação', 'ordem': ordem}
    assert MidiaRepository().buscar_por_tipo(None, pagina=2, limite=5, filtros=sem_tipo) == []


def test_nota_media_vem_das_avaliacoes_e_ordena_com_nulls_last(pg):
    avaliada = _midia(pg, 'anime', numero_episodios=12)
    sem_nota = _midia(pg, 'anime', numero_episodios=12)
    usuario = _usuario(pg)
    banco.executar(
        'INSERT INTO avaliacoes (id_usuario, id_midia, nota) VALUES (%s, %s, 10)', (usuario, avaliada)
    )

    midia = MidiaRepository().buscar_por_id(avaliada)
    assert midia['nota_media'] == Decimal('10.00') and midia['total_avaliacoes'] == 1

    listagem = MidiaRepository().buscar_por_tipo('anime', limite=50, filtros={'ordem': 'nota_media'})
    ids = [m['id_midia'] for m in listagem]
    if sem_nota in ids:
        assert ids.index(avaliada) < ids.index(sem_nota)


def test_item_copia_o_total_da_midia_e_nao_duplica(pg):
    anime = _midia(pg, 'anime', numero_episodios=12)
    jogo = _midia(pg, 'jogo')
    usuario = _usuario(pg)
    repo = ListaRepository()

    id_lista = repo.criar_item(usuario, anime, {'status_consumo': 'assistindo', 'favorito': 1})
    id_jogo = repo.criar_item(usuario, jogo, {'status_consumo': 'jogando'})

    assert uuid.UUID(id_lista)
    item = repo.obter_item_por_id(id_lista)
    assert item['progresso_total'] == 12 and item['progresso_total_padrao'] == 12
    assert item['id_usuario'] == usuario
    assert repo.obter_item_por_id(id_jogo)['progresso_total'] is None
    assert repo.criar_item(usuario, anime, {'status_consumo': 'planejado'}) is None

    assert repo.atualizar_campos(id_lista, {'progresso_atual': 12, 'status_consumo': 'completo', 'nota_usuario': None})
    lista = repo.obter_lista_usuario(usuario)
    assert {i['id_lista'] for i in lista} == {id_lista, id_jogo}

    estatisticas = banco.consultar(ESTATISTICAS_POR_TIPO, (usuario,))
    assert [(e['tipo'], e['total_midias'], e['concluidos'], e['favoritos']) for e in estatisticas] == [
        ('anime', 1, 1, 1), ('jogo', 1, 0, 0),
    ]

    assert repo.remover_item(id_lista, usuario) is True
    assert repo.remover_item(id_lista, usuario) is False


def test_permissoes_compoem_grupos_e_usuario_inexistente_nao_ganha_nada(pg):
    moderador = _usuario(pg, 'Moderadores')

    permissoes = get_user_permissions(moderador)
    assert permissoes['nivel_acesso'] == 'moderador'
    assert permissoes['grupos'] == 'Moderadores'
    assert permissoes['pode_moderar'] == 1 and permissoes['pode_deletar'] == 0

    assert get_user_permissions(str(uuid.uuid4()))['grupos'] is None


def test_atualizar_e_deletar_midia(pg):
    id_manga = _midia(pg, 'manga', numero_capitulos=10, autor='Urasawa')
    repo = MidiaRepository()

    assert repo.atualizar_midia_base(id_manga, {'titulo_portugues': 'Monstro', 'numero_capitulos': 162, 'generos': []})
    manga = repo.buscar_por_id(id_manga, expected_type='manga')
    assert manga['titulo_portugues'] == 'Monstro' and manga['progresso_total_padrao'] == 162
    assert repo.buscar_por_tipo('manga', filtros={'autor': 'urasawa'})

    assert repo.deletar_midia(id_manga) is True
    assert repo.deletar_midia(id_manga) is False
