"""Tradução de erros do módulo de banco, sem PostgreSQL: a conexão é um dublê.

Erros transitórios de concorrência (deadlock, falha de serialização) e consulta
cancelada são bugs ou carga, não banco fora do ar: propagam como estão (500) e
não viram `Indisponivel` (503).
"""
import logging

import pytest
from psycopg import errors

import banco


class _ConexaoQueFalha:
    def __init__(self, erro):
        self._erro = erro

    def execute(self, sql, params=None):
        raise self._erro


@pytest.mark.parametrize('erro', [
    errors.DeadlockDetected('deadlock detected'),
    errors.SerializationFailure('could not serialize access'),
    errors.QueryCanceled('canceling statement due to statement timeout'),
])
def test_concorrencia_e_cancelamento_propagam_sem_virar_indisponivel(erro, caplog):
    t = banco.Transacao(_ConexaoQueFalha(erro))

    with caplog.at_level(logging.ERROR, logger='banco'), pytest.raises(type(erro)) as capturado:
        t.consultar('SELECT 1')

    assert not isinstance(capturado.value, banco.ErroDeBanco)
    assert type(erro).__name__ in caplog.text


def test_conexao_perdida_continua_indisponivel():
    t = banco.Transacao(_ConexaoQueFalha(errors.AdminShutdown('terminating connection')))

    with pytest.raises(banco.Indisponivel):
        t.consultar('SELECT 1')


def test_rota_responde_500_em_deadlock(client, monkeypatch):
    t = banco.Transacao(_ConexaoQueFalha(errors.DeadlockDetected('deadlock detected')))
    monkeypatch.setattr('routes.avaliacoes.midia_repository.buscar_por_id', lambda _id: t.consultar('x'))

    resposta = client.get('/api/avaliacoes/qualquer')

    assert resposta.status_code == 500


def test_fechar_no_shutdown_e_registrado_uma_vez(monkeypatch):
    registros = []

    class _PoolFalso:
        check_connection = None

        def __init__(self, *_a, **_k):
            pass

        def open(self, wait=False):
            pass

        def close(self):
            pass

    monkeypatch.setattr(banco.atexit, 'register', registros.append)
    monkeypatch.setattr(banco, 'ConnectionPool', _PoolFalso)
    monkeypatch.setattr(banco, 'database_url', lambda: 'postgresql://falso')
    banco.fechar()
    try:
        for _ in range(3):
            banco._obter_pool()
            banco.fechar()
    finally:
        banco.fechar()

    assert len(registros) <= 1
