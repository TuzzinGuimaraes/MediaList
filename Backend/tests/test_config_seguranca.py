"""Defaults inseguros: o que o app aceita ao iniciar em produção e em dev."""
import os
import pathlib
import subprocess
import sys

import pytest

BACKEND_DIR = pathlib.Path(__file__).resolve().parents[1]

SEGREDOS_FORTES = {
    'JWT_SECRET_KEY': 'k3y-de-producao-com-entropia-suficiente-0123456789',
    'DB_PASSWORD': 'senha-forte-do-banco-9876',
}


def _importar_config(**env):
    """Importa config num processo novo. Valores vazios contam como ausentes:
    variável definida não é sobrescrita pelo .env."""
    ambiente = {**os.environ, **env}
    return subprocess.run(
        [sys.executable, '-c', 'import config'],
        cwd=BACKEND_DIR, env=ambiente, capture_output=True, text=True, timeout=30,
    )


def test_producao_com_segredos_proprios_inicia():
    resultado = _importar_config(APP_ENV='production', **SEGREDOS_FORTES)
    assert resultado.returncode == 0, resultado.stderr


def test_producao_sem_jwt_secret_recusa_iniciar():
    resultado = _importar_config(APP_ENV='production', **{**SEGREDOS_FORTES, 'JWT_SECRET_KEY': ''})
    assert resultado.returncode != 0
    assert 'JWT_SECRET_KEY' in resultado.stderr


def test_producao_com_jwt_secret_default_recusa_iniciar():
    resultado = _importar_config(
        APP_ENV='production', **{**SEGREDOS_FORTES, 'JWT_SECRET_KEY': 'sua-chave-secreta-super-segura'},
    )
    assert resultado.returncode != 0
    assert 'JWT_SECRET_KEY' in resultado.stderr


def test_producao_com_senha_do_banco_default_recusa_iniciar():
    resultado = _importar_config(
        APP_ENV='production', **{**SEGREDOS_FORTES, 'DB_PASSWORD': 'MediaList@2025!Secure'},
    )
    assert resultado.returncode != 0
    assert 'DB_PASSWORD' in resultado.stderr


def test_producao_sem_senha_do_banco_recusa_iniciar():
    resultado = _importar_config(APP_ENV='production', **{**SEGREDOS_FORTES, 'DB_PASSWORD': ''})
    assert resultado.returncode != 0
    assert 'DB_PASSWORD' in resultado.stderr


def test_dev_mantem_os_defaults():
    resultado = _importar_config(APP_ENV='development', JWT_SECRET_KEY='', DB_PASSWORD='')
    assert resultado.returncode == 0, resultado.stderr



DONO_FORTE = {'DB_OWNER_USER': 'medialist_owner', 'DB_OWNER_PASSWORD': 'senha-forte-do-dono-4321'}


def test_producao_com_dono_e_senha_propria_inicia():
    resultado = _importar_config(APP_ENV='production', **SEGREDOS_FORTES, **DONO_FORTE)
    assert resultado.returncode == 0, resultado.stderr


def test_producao_com_dono_sem_senha_recusa_iniciar():
    resultado = _importar_config(
        APP_ENV='production', **SEGREDOS_FORTES, **{**DONO_FORTE, 'DB_OWNER_PASSWORD': ''},
    )
    assert resultado.returncode != 0
    assert 'DB_OWNER_PASSWORD' in resultado.stderr


def test_producao_com_senha_do_dono_default_recusa_iniciar():
    resultado = _importar_config(
        APP_ENV='production', **SEGREDOS_FORTES, **{**DONO_FORTE, 'DB_OWNER_PASSWORD': 'medialist-owner-dev'},
    )
    assert resultado.returncode != 0
    assert 'DB_OWNER_PASSWORD' in resultado.stderr


def test_producao_sem_dono_nao_exige_senha_do_dono():
    """O backend não usa o dono: o compose nem passa DB_OWNER_* para ele."""
    resultado = _importar_config(
        APP_ENV='production', **SEGREDOS_FORTES, DB_OWNER_USER='', DB_OWNER_PASSWORD='',
    )
    assert resultado.returncode == 0, resultado.stderr


def test_url_do_dono_usa_o_dono(monkeypatch):
    import config

    monkeypatch.setenv('DB_OWNER_USER', 'dono')
    monkeypatch.setenv('DB_OWNER_PASSWORD', 's3nha')

    assert config.database_url(dono=True).startswith('postgresql://dono:s3nha@')


def test_url_do_dono_sem_db_owner_user_levanta_erro(monkeypatch):
    import config

    monkeypatch.setenv('DB_OWNER_USER', '')
    monkeypatch.setenv('DB_USER', 'media_app_user')

    with pytest.raises(RuntimeError, match='DB_OWNER_USER'):
        config.database_url(dono=True)
