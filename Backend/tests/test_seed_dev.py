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
