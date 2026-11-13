"""Gravação da Importação no PostgreSQL real (ticket 23): upsert por anilist_id/rawg_slug.

Usa TEST_DATABASE_URL (usuário da aplicação, schema migrado); sem ela, pula.
Cada teste apaga o que gravou.
"""
import os
import random
import uuid
from decimal import Decimal

import pytest

import banco
from importacao import db

TEST_DATABASE_URL = os.getenv('TEST_DATABASE_URL')

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para a Importação'
)


@pytest.fixture
def pg(monkeypatch):
    banco.fechar()
    monkeypatch.setattr(banco, 'database_url', lambda: TEST_DATABASE_URL)
    criados = {'midias': [], 'usuarios': [], 'generos': []}
    yield criados
    if criados['midias']:
        banco.executar('DELETE FROM midias WHERE id_midia = ANY(%s::uuid[])', (criados['midias'],))
    if criados['usuarios']:
        banco.executar('DELETE FROM usuarios WHERE id_usuario = ANY(%s::uuid[])', (criados['usuarios'],))
    if criados['generos']:
        banco.executar('DELETE FROM generos WHERE nome_genero = ANY(%s)', (criados['generos'],))
    banco.fechar()


def _anilist_id():
    return random.randint(10**8, 2 * 10**9)


def _anime(anilist_id, **extra):
    return {
        'titulo_original': 'Original',
        'titulo_portugues': 'Primeiro título',
        'status_anime': 'finalizado',
        'numero_episodios': 12,
        'nota_fonte': Decimal('8.7'),
        'anilist_id': anilist_id,
        **extra,
    }


def _salvar(pg, funcao, dados, generos=()):
    resultado = funcao(dados, list(generos))
    pg['midias'].append(resultado['id_midia'])
    return resultado


def _midia(id_midia):
    return banco.consultar_um(
        'SELECT titulo_portugues, nota_fonte FROM midias WHERE id_midia = %s', (id_midia,)
    )


def test_reimportar_anime_atualiza_a_midia_sem_duplicar(pg):
    anilist_id = _anilist_id()

    primeira = _salvar(pg, db.salvar_anime, _anime(anilist_id))
    segunda = _salvar(
        pg, db.salvar_anime,
        _anime(anilist_id, titulo_portugues='Título novo', nota_fonte=Decimal('9.1'), numero_episodios=13),
    )

    assert primeira['ja_existia'] is False
    assert segunda == {'id_midia': primeira['id_midia'], 'ja_existia': True}
    assert banco.consultar_um(
        'SELECT count(*) AS n FROM animes WHERE anilist_id = %s', (anilist_id,)
    )['n'] == 1
    assert _midia(primeira['id_midia']) == {'titulo_portugues': 'Título novo', 'nota_fonte': Decimal('9.1')}
    assert banco.consultar_um(
        'SELECT numero_episodios FROM animes WHERE id_midia = %s', (primeira['id_midia'],)
    )['numero_episodios'] == 13


def test_manga_sem_nota_grava_nota_fonte_nula_e_reimporta_pelo_anilist_id(pg):
    anilist_id = _anilist_id()
    dados = {'titulo_original': 'Mangá', 'status_manga': 'em_publicacao', 'anilist_id': anilist_id, 'nota_fonte': None}

    primeira = _salvar(pg, db.salvar_manga, dados)
    segunda = _salvar(pg, db.salvar_manga, {**dados, 'nota_fonte': Decimal('10.0'), 'demografia': 'seinen'})

    assert segunda == {'id_midia': primeira['id_midia'], 'ja_existia': True}
    assert _midia(primeira['id_midia'])['nota_fonte'] == Decimal('10.0')
    assert banco.consultar_um(
        'SELECT demografia FROM mangas WHERE id_midia = %s', (primeira['id_midia'],)
    )['demografia'] == 'seinen'


def test_generos_novos_e_existentes_com_vinculo_idempotente(pg):
    novo = f'Gênero PG {uuid.uuid4().hex[:8]}'
    pg['generos'].append(novo)
    anilist_id = _anilist_id()

    primeira = _salvar(pg, db.salvar_anime, _anime(anilist_id), ['Ação', novo])
    _salvar(pg, db.salvar_anime, _anime(anilist_id), ['Ação', novo, novo])

    vinculados = banco.consultar(
        'SELECT g.nome_genero FROM midias_generos mg JOIN generos g USING (id_genero) '
        'WHERE mg.id_midia = %s ORDER BY g.nome_genero',
        (primeira['id_midia'],),
    )
    assert [v['nome_genero'] for v in vinculados] == sorted(['Ação', novo])
    assert banco.consultar_um(
        'SELECT count(*) AS n FROM generos WHERE nome_genero = %s', (novo,)
    )['n'] == 1


def test_jogo_grava_plataformas_como_array_e_reimporta_pelo_slug(pg):
    slug = f'jogo-pg-{uuid.uuid4().hex}'
    novo = f'Gênero PG {uuid.uuid4().hex[:8]}'
    pg['generos'].append(novo)
    dados = {
        'titulo_original': 'Jogo', 'status_jogo': 'lancado', 'modo_jogo': 'single',
        'plataformas': ['PC', 'Switch'], 'nota_fonte': Decimal('9.0'), 'rawg_slug': slug,
    }

    primeira = _salvar(pg, db.salvar_jogo, dados, [novo])
    segunda = _salvar(pg, db.salvar_jogo, {**dados, 'plataformas': ['PC', 'PS5', 'Switch']}, [novo])

    assert segunda == {'id_midia': primeira['id_midia'], 'ja_existia': True}
    assert banco.consultar_um(
        'SELECT plataformas FROM jogos WHERE rawg_slug = %s', (slug,)
    )['plataformas'] == ['PC', 'PS5', 'Switch']
    assert banco.consultar_um(
        'SELECT aplicavel_a FROM generos WHERE nome_genero = %s', (novo,)
    )['aplicavel_a'] == ['jogo']


def test_reimportar_nao_toca_em_avaliacoes_nem_itens(pg):
    anilist_id = _anilist_id()
    id_midia = _salvar(pg, db.salvar_anime, _anime(anilist_id))['id_midia']
    with banco.transacao() as t:
        id_usuario = t.consultar_um(
            "INSERT INTO usuarios (nome_completo, email, senha_hash) VALUES ('PG', %s, 'x') RETURNING id_usuario",
            (f'pg-{uuid.uuid4().hex}@exemplo.test',),
        )['id_usuario']
        t.executar(
            "INSERT INTO avaliacoes (id_usuario, id_midia, nota) VALUES (%s, %s, 6.5)", (id_usuario, id_midia)
        )
        t.executar(
            "INSERT INTO lista_usuarios (id_usuario, id_midia, status_consumo, progresso_atual, progresso_total) "
            "VALUES (%s, %s, 'assistindo', 3, 12)",
            (id_usuario, id_midia),
        )
    pg['usuarios'].append(id_usuario)

    _salvar(pg, db.salvar_anime, _anime(anilist_id, numero_episodios=24, nota_fonte=Decimal('7.0')))

    assert banco.consultar(
        'SELECT nota FROM avaliacoes WHERE id_midia = %s', (id_midia,)
    ) == [{'nota': Decimal('6.5')}]
    assert banco.consultar(
        'SELECT status_consumo, progresso_atual, progresso_total FROM lista_usuarios WHERE id_midia = %s',
        (id_midia,),
    ) == [{'status_consumo': 'assistindo', 'progresso_atual': 3, 'progresso_total': 12}]
