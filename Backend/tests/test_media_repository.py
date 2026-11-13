from repositories import midia_repository as modulo
from repositories.midia_repository import ListaRepository, MidiaRepository, _serialize_row

from .helpers import FakeBanco


def test_serialize_row_gera_generos_lista():
    row = _serialize_row({
        'nota_media': 8.7,
        'generos': 'Ação, Drama, Fantasia',
    })

    assert row == {
        'nota_media': 8.7,
        'generos': 'Ação, Drama, Fantasia',
        'generos_lista': ['Ação', 'Drama', 'Fantasia'],
    }


def test_build_filters_monta_clausulas_por_tipo():
    repo = MidiaRepository()

    where, params = repo._build_filters('jogo', {
        'busca': 'zelda',
        'genero': 'Aventura',
        'status': 'lancado',
        'plataforma': 'Switch',
        'desenvolvedor': 'Nintendo',
        'modo_jogo': 'single',
    })

    assert 'tm.nome_tipo = %s' in where
    assert 'm.titulo_portugues ILIKE %s' in where
    assert 'j.status_jogo = %s' in where
    # Plataforma é elemento do text[], não substring de um CSV.
    assert 'j.plataformas @> ARRAY[%s]::text[]' in where
    assert 'j.desenvolvedor ILIKE %s' in where
    assert 'j.modo_jogo = %s' in where
    assert params == [
        'jogo',
        '%zelda%',
        '%zelda%',
        '%zelda%',
        'Aventura',
        'lancado',
        'Switch',
        '%Nintendo%',
        'single',
    ]



def test_buscar_por_id_combina_campos_base_e_tipo(monkeypatch):
    repo = MidiaRepository()
    capturado = {}

    def fake_fetch_one(query, params):
        capturado['query'] = query
        capturado['params'] = params
        return {'id_midia': 'MID-1', 'tipo': 'anime'}

    monkeypatch.setattr(repo, '_fetch_one', fake_fetch_one)

    result = repo.buscar_por_id('MID-1', expected_type='anime')

    assert result == {'id_midia': 'MID-1', 'tipo': 'anime'}
    assert 'LEFT JOIN animes' in capturado['query']
    # Nota média e Total de avaliações vêm da view, não de colunas de midias.
    assert 'JOIN vw_notas_midia n' in capturado['query']
    assert capturado['params'] == ['MID-1', 'anime']


def test_inserir_jogo_grava_plataformas_como_lista(monkeypatch):
    fake = FakeBanco({'INSERT INTO midias': {'id_midia': 'MID-J'}}).instalar(monkeypatch, modulo)

    id_midia = MidiaRepository().inserir_midia_base('jogo', {
        'titulo_original': 'Jogo',
        'plataformas': 'PC, Switch ,',
        'generos': [1, 2],
    })

    assert id_midia == 'MID-J'
    _metodo, sql, params = fake.sql('INSERT INTO jogos')[0]
    assert params == ('MID-J', ['PC', 'Switch'])
    assert len(fake.sql('INSERT INTO midias_generos')) == 2
    assert fake.transacoes == 1


def test_obter_item_usuario_retorna_item(monkeypatch):
    repo = ListaRepository()
    monkeypatch.setattr(
        repo, '_fetch_one', lambda *_args, **_kwargs: {'id_lista': 'LST-1', 'id_usuario': 'USR-1', 'id_midia': 'MID-1'}
    )

    result = repo.obter_item_usuario('USR-1', 'MID-1')

    assert result['id_lista'] == 'LST-1'


def test_criar_item_insere_colunas_conhecidas_e_devolve_o_id(monkeypatch):
    fake = FakeBanco({'INSERT INTO lista_usuarios': {'id_lista': 'LST-9'}}).instalar(monkeypatch, modulo)

    id_lista = ListaRepository().criar_item('USR-1', 'MID-1', {
        'status_consumo': 'assistindo',
        'progresso_atual': 3,
        'favorito': 1,
        'campo_invalido': 'ignorar',
    })

    _metodo, query, params = fake.chamadas[0]
    assert id_lista == 'LST-9'
    assert 'INSERT INTO lista_usuarios' in query
    assert 'campo_invalido' not in query
    # O total do Item é copiado da Mídia na criação (antes, trigger do MySQL).
    assert 'progresso_total' in query and 'numero_episodios' in query
    assert params == ('USR-1', 'MID-1', 'MID-1', 'assistindo', 3, True)


def test_criar_item_ja_existente_devolve_none(monkeypatch):
    """A unique key barrando (ON CONFLICT sem linha) é conflito de domínio, não erro."""
    FakeBanco({'INSERT INTO lista_usuarios': None}).instalar(monkeypatch, modulo)

    assert ListaRepository().criar_item('USR-1', 'MID-1', {'status_consumo': 'assistindo'}) is None


def test_remover_item_diz_se_apagou_alguma_linha(monkeypatch):
    FakeBanco({'DELETE FROM lista_usuarios': 0}).instalar(monkeypatch, modulo)

    assert ListaRepository().remover_item('LST-1', 'USR-1') is False


def test_atualizar_campos_persiste_apenas_colunas_permitidas(monkeypatch):
    fake = FakeBanco().instalar(monkeypatch, modulo)

    result = ListaRepository().atualizar_campos('LST-1', {
        'status_consumo': 'assistindo',
        'nota_usuario': None,
        'favorito': 1,
        'comentario': 'Teste',
        'privado': 0,
        'progresso_total': 24,
        'campo_invalido': 'ignorar',
    })

    _metodo, query, params = fake.chamadas[0]
    assert result is True
    assert 'status_consumo = %s' in query
    assert 'nota_usuario = NULL' in query
    assert 'favorito = %s' in query
    assert 'comentario = %s' in query
    assert 'privado = %s' in query
    assert 'campo_invalido' not in query
    # O total pertence à Mídia: o Item não o recebe do cliente.
    assert 'progresso_total' not in query
    assert params == ('assistindo', True, 'Teste', False, 'LST-1')


def test_lista_do_usuario_em_ordem_alfabetica_do_titulo_exibido(monkeypatch):
    """Título exibido = português, senão original; sem caixa; empate pelo id_lista.

    Editar um Item não pode mudar a posição dele (ticket 28).
    """
    repo = ListaRepository()
    linhas = [
        {'id_lista': 'LST-3', 'titulo_portugues': 'banana', 'titulo_original': 'Z'},
        {'id_lista': 'LST-1', 'titulo_portugues': None, 'titulo_original': 'Celeste'},
        {'id_lista': 'LST-4', 'titulo_portugues': '', 'titulo_original': 'Akira'},
        {'id_lista': 'LST-2', 'titulo_portugues': 'Banana', 'titulo_original': 'A'},
    ]
    monkeypatch.setattr(repo, '_fetch_all', lambda *_args, **_kwargs: list(linhas))

    resultado = repo.obter_lista_usuario('USR-1')

    assert [linha['id_lista'] for linha in resultado] == ['LST-4', 'LST-2', 'LST-3', 'LST-1']
