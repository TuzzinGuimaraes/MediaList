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
