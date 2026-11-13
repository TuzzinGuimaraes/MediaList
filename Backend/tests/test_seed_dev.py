"""Seed de desenvolvimento (ticket 15).

A recusa em produção roda sem banco. O resto usa TEST_DATABASE_URL (usuário da
aplicação, schema migrado) e pula sem ela. Os testes apagam os Usuários do seed
no fim; as Mídias do seed ficam, como no `--recriar`.
"""
import os
import uuid

import pytest

import banco
import seed_dev

TEST_DATABASE_URL = os.getenv('TEST_DATABASE_URL')

precisa_de_banco = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para o seed'
)


def test_recusa_rodar_em_producao(monkeypatch, capsys):
    monkeypatch.setenv('APP_ENV', 'production')

    assert seed_dev.main([]) != 0
    assert 'produção' in capsys.readouterr().err



EMAILS_DO_SEED = ['teste@medialist.dev', 'admin@medialist.dev', 'moderador@medialist.dev']


@pytest.fixture
def pg(monkeypatch):
    banco.fechar()
    monkeypatch.setattr(banco, 'database_url', lambda: TEST_DATABASE_URL)
    monkeypatch.delenv('APP_ENV', raising=False)
    outros = []
    yield outros
    banco.executar(
        'DELETE FROM noticias WHERE id_autor IN (SELECT id_usuario FROM usuarios WHERE email = ANY(%s))',
        (EMAILS_DO_SEED,),
    )
    banco.executar('DELETE FROM usuarios WHERE email = ANY(%s) OR id_usuario = ANY(%s::uuid[])',
                   (EMAILS_DO_SEED, outros))
    banco.fechar()


def _contagem_do_seed() -> dict:
    """Quanto existe de cada coisa que o seed cria, pelas chaves naturais."""
    return banco.consultar_um(
        """
        WITH seed AS (SELECT id_usuario FROM usuarios WHERE email = ANY(%(emails)s))
        SELECT
            (SELECT count(*) FROM usuarios WHERE email = ANY(%(emails)s)) AS usuarios,
            (SELECT count(*) FROM usuarios_grupos WHERE id_usuario IN (SELECT * FROM seed)) AS grupos,
            (SELECT count(*) FROM lista_usuarios WHERE id_usuario IN (SELECT * FROM seed)) AS itens,
            (SELECT count(*) FROM avaliacoes WHERE id_usuario IN (SELECT * FROM seed)) AS avaliacoes,
            (SELECT count(*) FROM noticias WHERE id_autor IN (SELECT * FROM seed)) AS noticias,
            (SELECT count(*) FROM notificacoes WHERE id_usuario IN (SELECT * FROM seed)) AS notificacoes,
            (SELECT count(*) FROM midias) AS midias,
            (SELECT count(*) FROM midias_generos) AS midias_generos,
            (SELECT count(*) FROM atualizacoes_midia) AS atualizacoes
        """,
        {'emails': EMAILS_DO_SEED},
    )


@precisa_de_banco
def test_rodar_duas_vezes_nao_duplica(pg, capsys):
    assert seed_dev.main([]) == 0
    primeira = _contagem_do_seed()
    assert seed_dev.main([]) == 0
    segunda = _contagem_do_seed()

    assert segunda == primeira
    assert primeira['usuarios'] == 3
    assert primeira['noticias'] == 2
    assert primeira['notificacoes'] == 2
    assert 'teste@medialist.dev / teste123' in capsys.readouterr().out



def _id_do_teste():
    return banco.consultar_um("SELECT id_usuario FROM usuarios WHERE email = 'teste@medialist.dev'")['id_usuario']


@precisa_de_banco
def test_lista_do_teste_cobre_todos_os_estados_de_cada_tipo(pg):
    from repositories import ItensLista

    seed_dev.main([])
    itens = ItensLista().listar(_id_do_teste())

    assert {(i['tipo'], i['status_consumo']) for i in itens} == {
        ('anime', 'planejado'), ('anime', 'assistindo'), ('anime', 'pausado'),
        ('anime', 'abandonado'), ('anime', 'completo'),
        ('manga', 'planejado'), ('manga', 'lendo'), ('manga', 'pausado'),
        ('manga', 'abandonado'), ('manga', 'lido'),
        ('jogo', 'na_fila'), ('jogo', 'jogando'), ('jogo', 'pausado'),
        ('jogo', 'abandonado'), ('jogo', 'zerado'), ('jogo', 'platinado'),
    }
    # Concluído ⇔ Progresso = total: todo anime/mangá concluído com total está no total.
    for item in itens:
        if item['status_consumo'] in ('completo', 'lido') and item['progresso_total']:
            assert item['progresso_atual'] == item['progresso_total']
    assert any(i['tipo'] == 'manga' and i['progresso_total'] is None and i['progresso_atual'] for i in itens)
    assert any(i['total_rewatches'] > 0 for i in itens)
    assert any(i['privado'] for i in itens) and any(i['favorito'] for i in itens)



@precisa_de_banco
def test_recriar_refaz_os_dados_do_seed_sem_tocar_em_outro_usuario(pg, capsys):
    seed_dev.main([])
    id_teste_antes = _id_do_teste()
    frieren = banco.consultar_um('SELECT id_midia FROM animes WHERE anilist_id = 154587')['id_midia']
    with banco.transacao() as t:
        outro = t.consultar_um(
            "INSERT INTO usuarios (nome_completo, email, senha_hash) VALUES ('Outro', %s, 'x') RETURNING id_usuario",
            (f'outro-{uuid.uuid4().hex}@exemplo.test',),
        )['id_usuario']
        t.executar("INSERT INTO lista_usuarios (id_usuario, id_midia, status_consumo) VALUES (%s, %s, 'assistindo')",
                   (outro, frieren))
        t.executar('INSERT INTO avaliacoes (id_usuario, id_midia, nota) VALUES (%s, %s, 7)', (outro, frieren))
    pg.append(outro)
    # Um Item do teste fora do seed: o --recriar o leva junto com o Usuário.
    banco.executar("UPDATE lista_usuarios SET comentario = 'mexido' WHERE id_usuario = %s", (id_teste_antes,))
    antes = _contagem_do_seed()

    assert seed_dev.main(['--recriar']) == 0

    assert _id_do_teste() != id_teste_antes
    assert _contagem_do_seed() == antes
    assert banco.consultar_um(
        "SELECT count(*) AS n FROM lista_usuarios WHERE id_usuario = %s AND comentario = 'mexido'", (_id_do_teste(),)
    )['n'] == 0
    assert banco.consultar_um(
        'SELECT (SELECT count(*) FROM lista_usuarios WHERE id_usuario = %(u)s) AS itens, '
        '(SELECT count(*) FROM avaliacoes WHERE id_usuario = %(u)s) AS avaliacoes',
        {'u': outro},
    ) == {'itens': 1, 'avaliacoes': 1}
