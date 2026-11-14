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
    admin = _usuario(pg, 'admin')
    novos = [_usuario(pg) for _ in range(2)]

    primeira = client.get('/api/moderacao/usuarios?por_pagina=2', headers=entrar(admin)).get_json()
    segunda = client.get('/api/moderacao/usuarios?por_pagina=2&pagina=2', headers=entrar(admin)).get_json()

    assert primeira['total'] == banco.consultar_um('SELECT count(*) AS n FROM usuarios')['n']
    assert segunda['total'] == primeira['total']
    # Mais recentes primeiro, sem repetir entre as páginas.
    assert [u['id_usuario'] for u in primeira['itens']] == list(reversed(novos))
    assert segunda['itens'][0]['id_usuario'] == admin
    assert segunda['itens'][0]['nivel_acesso'] == 'admin'
    assert primeira['itens'][0]['nivel_acesso'] == 'usuario'
    assert set(primeira['itens'][0]) == {
        'id_usuario', 'nome_completo', 'email', 'data_cadastro', 'ultimo_acesso', 'ativo', 'nivel_acesso',
        'total_midias', 'total_avaliacoes',
    }


def test_admin_promove_usuario_e_o_novo_admin_entra_na_moderacao(client, pg, entrar):  # noqa: F811
    admin, comum = _usuario(pg, 'admin'), _usuario(pg)
    assert client.get('/api/moderacao/usuarios', headers=entrar(comum)).status_code == 403

    promover = client.put(
        f'/api/moderacao/usuarios/{comum}/nivel', headers=entrar(admin), json={'nivel_acesso': 'admin'},
    )

    assert promover.status_code == 200
    assert client.get('/api/moderacao/usuarios', headers=entrar(comum)).status_code == 200
    # Agora são dois admins: um não desativa nem rebaixa o outro.
    assert client.put(f'/api/moderacao/usuarios/{admin}/desativar', headers=entrar(comum)).status_code == 403
    rebaixar = client.put(
        f'/api/moderacao/usuarios/{admin}/nivel', headers=entrar(comum), json={'nivel_acesso': 'usuario'},
    )
    assert rebaixar.status_code == 403


def test_avaliacoes_da_moderacao_com_a_midia(client, pg, entrar):  # noqa: F811
    admin, autora = _usuario(pg, 'admin'), _usuario(pg)
    id_midia = Catalogo().criar('anime', {'titulo_original': f'PG {uuid.uuid4().hex}'})
    pg['midias'].append(id_midia)
    client.post('/api/avaliacoes', headers=entrar(autora), json={'id_midia': id_midia, 'nota': 7.5})

    resposta = client.get('/api/moderacao/avaliacoes', headers=entrar(admin))

    assert resposta.status_code == 200
    [avaliacao] = [a for a in resposta.get_json()['avaliacoes'] if a['id_midia'] == id_midia]
    assert (avaliacao['id_usuario'], avaliacao['nota'], avaliacao['tipo']) == (autora, 7.5, 'anime')
    assert avaliacao['titulo_portugues'] is None
