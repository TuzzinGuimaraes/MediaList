"""Defaults inseguros: o que o app aceita ao iniciar em produção e em dev."""
import os
import pathlib
import subprocess
import sys

BACKEND_DIR = pathlib.Path(__file__).resolve().parents[1]

SEGREDOS_FORTES = {
    'JWT_SECRET_KEY': 'k3y-de-producao-com-entropia-suficiente-0123456789',
    'DB_PASSWORD': 'senha-forte-do-banco-9876',
    'MONGO_URI': 'mongodb://medialist_app:senha-forte-mongo-5555@mongodb:27017/medialist_updates_db',
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


def test_producao_com_uri_mongo_de_senha_default_recusa_iniciar():
    resultado = _importar_config(
        APP_ENV='production',
        **{**SEGREDOS_FORTES, 'MONGO_URI': 'mongodb://admin:senha123@mongodb:27017/'},
    )
    assert resultado.returncode != 0
    assert 'MONGO_URI' in resultado.stderr


def test_producao_sem_uri_mongo_recusa_iniciar():
    resultado = _importar_config(APP_ENV='production', **{**SEGREDOS_FORTES, 'MONGO_URI': ''})
    assert resultado.returncode != 0
    assert 'MONGO_URI' in resultado.stderr


def test_dev_mantem_os_defaults():
    resultado = _importar_config(APP_ENV='development', JWT_SECRET_KEY='', DB_PASSWORD='', MONGO_URI='')
    assert resultado.returncode == 0, resultado.stderr
