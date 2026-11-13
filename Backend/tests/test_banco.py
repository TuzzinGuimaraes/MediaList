"""Módulo de acesso ao PostgreSQL contra um banco real.

A URL vem de TEST_DATABASE_URL (usuário da aplicação, schema migrado); sem
ela, o módulo é pulado. Cada teste apaga o que gravou.
"""
import os
import uuid

import pytest

import banco

TEST_DATABASE_URL = os.getenv('TEST_DATABASE_URL')

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para o módulo de banco'
)


@pytest.fixture
def pg(monkeypatch):
    banco.fechar()
    monkeypatch.setattr(banco, 'database_url', lambda: TEST_DATABASE_URL)
    emails = []
    yield emails
    if emails:
        banco.executar('DELETE FROM usuarios WHERE email = ANY(%s)', (emails,))
    banco.fechar()


def _email(pg):
    email = f'banco-{uuid.uuid4().hex}@exemplo.test'
    pg.append(email)
    return email


def _criar_usuario(email, executor=banco):
    return executor.consultar_um(
        "INSERT INTO usuarios (nome_completo, email, senha_hash) VALUES ('Banco', %s, 'x') RETURNING id_usuario",
        (email,),
    )['id_usuario']


def test_pool_so_abre_na_primeira_consulta(pg):
    assert banco.pool_aberto() is False

    assert banco.consultar_um('SELECT 1 AS um') == {'um': 1}

    assert banco.pool_aberto() is True


def test_consultar_devolve_linhas_como_dict_e_uuid_como_texto(pg):
    id_usuario = _criar_usuario(_email(pg))

    linhas = banco.consultar('SELECT id_usuario, ativo FROM usuarios WHERE id_usuario = %s', (id_usuario,))

    assert linhas == [{'id_usuario': id_usuario, 'ativo': True}]
    assert isinstance(id_usuario, str)
    assert banco.consultar_um('SELECT 1 AS um WHERE false') is None


def test_executar_devolve_linhas_afetadas(pg):
    email = _email(pg)
    _criar_usuario(email)

    assert banco.executar('UPDATE usuarios SET biografia = %s WHERE email = %s', ('bio', email)) == 1
    assert banco.executar('UPDATE usuarios SET biografia = %s WHERE email = %s', ('bio', 'ninguem@x.test')) == 0


def test_unique_vira_conflito(pg):
    email = _email(pg)
    _criar_usuario(email)

    with pytest.raises(banco.Conflito):
        _criar_usuario(email)


def test_fk_e_check_viram_integridade(pg):
    id_usuario = _criar_usuario(_email(pg))
    midia_inexistente = str(uuid.uuid4())

    with pytest.raises(banco.Integridade):
        banco.executar(
            "INSERT INTO lista_usuarios (id_usuario, id_midia, status_consumo) VALUES (%s, %s, 'assistindo')",
            (id_usuario, midia_inexistente),
        )
    with pytest.raises(banco.Integridade):
        banco.executar("UPDATE usuarios SET preferencias = '[]'::jsonb WHERE id_usuario = %s", (id_usuario,))


def test_valor_fora_do_tipo_vira_integridade(pg):
    with pytest.raises(banco.Integridade):
        banco.consultar_um('SELECT id_usuario FROM usuarios WHERE id_usuario = %s', ('nao-e-uuid',))


def test_erro_de_sql_propaga_sem_traducao(pg):
    with pytest.raises(Exception) as erro:
        banco.consultar('SELECT coluna_que_nao_existe FROM usuarios')

    assert not isinstance(erro.value, banco.ErroDeBanco)


def test_transacao_confirma_tudo_no_fim(pg):
    email = _email(pg)

    with banco.transacao() as t:
        id_usuario = _criar_usuario(email, t)
        t.executar('UPDATE usuarios SET biografia = %s WHERE id_usuario = %s', ('bio', id_usuario))

    assert banco.consultar_um('SELECT biografia FROM usuarios WHERE email = %s', (email,)) == {'biografia': 'bio'}


def test_transacao_desfaz_tudo_em_erro(pg):
    email = _email(pg)

    with pytest.raises(RuntimeError), banco.transacao() as t:
        _criar_usuario(email, t)
        raise RuntimeError('aborta')

    assert banco.consultar_um('SELECT 1 AS existe FROM usuarios WHERE email = %s', (email,)) is None


def test_transacao_traduz_erro_e_desfaz(pg):
    email = _email(pg)
    outro = _email(pg)
    _criar_usuario(email)

    with pytest.raises(banco.Conflito), banco.transacao() as t:
        _criar_usuario(outro, t)
        _criar_usuario(email, t)

    assert banco.consultar_um('SELECT 1 AS existe FROM usuarios WHERE email = %s', (outro,)) is None


def test_banco_fora_do_ar_vira_indisponivel(monkeypatch):
    banco.fechar()
    monkeypatch.setattr(banco, 'database_url', lambda: 'postgresql://ninguem:x@127.0.0.1:1/nada')
    monkeypatch.setattr(banco, 'DB_POOL_TIMEOUT', 1)
    try:
        with pytest.raises(banco.Indisponivel):
            banco.consultar('SELECT 1')
    finally:
        banco.fechar()
