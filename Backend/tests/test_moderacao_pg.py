"""Listagens da moderação no PostgreSQL real, pelo app (contrato da API, ticket 05).

Usa TEST_DATABASE_URL; sem ela, pula. Cada teste apaga o que gravou.
"""
import uuid

import pytest

import banco
from repositories import Catalogo

from .test_repositorios_pg import TEST_DATABASE_URL, _usuario, pg  # noqa: F401 (fixture)

pytestmark = pytest.mark.skipif(not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL')


@pytest.fixture
def entrar(make_token):
    return lambda id_usuario: {'Authorization': f'Bearer {make_token(id_usuario)}'}


def test_usuarios_da_moderacao_paginados_com_o_total(client, pg, entrar):  # noqa: F811
    admin = _usuario(pg, 'Administradores')
    novos = [_usuario(pg) for _ in range(2)]

    primeira = client.get('/api/moderacao/usuarios?por_pagina=2', headers=entrar(admin)).get_json()
    segunda = client.get('/api/moderacao/usuarios?por_pagina=2&pagina=2', headers=entrar(admin)).get_json()

    assert primeira['total'] == banco.consultar_um('SELECT count(*) AS n FROM usuarios')['n']
    assert segunda['total'] == primeira['total']
    # Mais recentes primeiro, sem repetir entre as páginas.
    assert [u['id_usuario'] for u in primeira['itens']] == list(reversed(novos))
    assert segunda['itens'][0]['id_usuario'] == admin
    assert segunda['itens'][0]['grupos'] == 'Administradores'
    assert set(primeira['itens'][0]) == {
        'id_usuario', 'nome_completo', 'email', 'data_cadastro', 'ultimo_acesso', 'ativo', 'grupos',
        'total_midias', 'total_avaliacoes',
    }


def test_avaliacoes_da_moderacao_com_a_midia(client, pg, entrar):  # noqa: F811
    moderador, autora = _usuario(pg, 'Moderadores'), _usuario(pg)
    id_midia = Catalogo().criar('anime', {'titulo_original': f'PG {uuid.uuid4().hex}'})
    pg['midias'].append(id_midia)
    client.post('/api/avaliacoes', headers=entrar(autora), json={'id_midia': id_midia, 'nota': 7.5})

    resposta = client.get('/api/moderacao/avaliacoes', headers=entrar(moderador))

    assert resposta.status_code == 200
    [avaliacao] = [a for a in resposta.get_json()['avaliacoes'] if a['id_midia'] == id_midia]
    assert (avaliacao['id_usuario'], avaliacao['nota'], avaliacao['tipo']) == (autora, 7.5, 'anime')
    assert avaliacao['titulo_portugues'] is None
