"""Autorização de ponta a ponta contra o PostgreSQL real (ticket 26).

Blocklist persistida dos access tokens e Usuário inexistente ou desativado sem
acesso. "Outra instância" é um processo Python novo importando o app: nada em
memória sobrevive, como num restart ou noutro worker do gunicorn.

Usa TEST_DATABASE_URL (usuário da aplicação, schema migrado); sem ela, pula.
"""
import json
import os
import pathlib
import subprocess
import sys
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from flask_jwt_extended import create_access_token

import banco
from repositories import AcessoRepository, RefreshTokenRepository
from routes import auth as auth_routes

TEST_DATABASE_URL = os.getenv('TEST_DATABASE_URL')
BACKEND = pathlib.Path(__file__).resolve().parents[1]

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para a autorização'
)

_OUTRA_INSTANCIA = """
import json
import sys
import banco
banco.database_url = lambda: sys.argv[1]
from app import app
resposta = app.test_client().open(
    sys.argv[3], method=sys.argv[2], json=json.loads(sys.argv[5]),
    headers={'Authorization': 'Bearer ' + sys.argv[4]},
)
print(resposta.status_code)
"""


def em_outra_instancia(metodo, rota, token, corpo=None):
    """Status da requisição feita por um processo novo do app."""
    saida = subprocess.run(
        [sys.executable, '-c', _OUTRA_INSTANCIA, TEST_DATABASE_URL, metodo, rota, token, json.dumps(corpo)],
        cwd=BACKEND, capture_output=True, text=True, check=True, timeout=60,
    )
    return int(saida.stdout.strip().splitlines()[-1])


@pytest.fixture
def pg(monkeypatch):
    """Banco e repositórios reais; apaga os Usuários criados no fim."""
    banco.fechar()
    monkeypatch.setattr(banco, 'database_url', lambda: TEST_DATABASE_URL)
    monkeypatch.setattr(auth_routes, 'refresh_token_repository', RefreshTokenRepository())
    monkeypatch.setattr(auth_routes, 'acesso_repository', AcessoRepository())
    criados = []
    yield criados
    if criados:
        banco.executar('DELETE FROM usuarios WHERE id_usuario = ANY(%s::uuid[])', (criados,))
    banco.fechar()


@pytest.fixture
def entrar(client, pg):
    """Registra um Usuário pela API e faz login; devolve (id, access, refresh)."""
    def _entrar():
        email = f'auth-{uuid.uuid4().hex}@exemplo.test'
        registro = client.post('/api/auth/registro', json={
            'nome_completo': 'Autorização', 'email': email, 'senha': 'segredo1',
        })
        assert registro.status_code == 201
        pg.append(registro.get_json()['id_usuario'])
        login = client.post('/api/auth/login', json={'email': email, 'senha': 'segredo1'}).get_json()
        return login['usuario']['id'], login['access_token'], login['refresh_token']

    return _entrar


def _bearer(token):
    return {'Authorization': f'Bearer {token}'}


def test_logout_continua_valendo_em_outra_instancia_do_app(client, entrar):
    _id, access, _refresh = entrar()
    assert em_outra_instancia('GET', '/api/auth/me', access) == 200

    assert client.post('/api/auth/logout', headers=_bearer(access)).status_code == 200

    assert client.get('/api/auth/me', headers=_bearer(access)).status_code == 401
    assert em_outra_instancia('GET', '/api/auth/me', access) == 401


def test_token_de_recuperacao_usado_nao_vale_mais_nem_em_outra_instancia(client, entrar, app):
    id_usuario, _access, _refresh = entrar()
    with app.app_context():
        recuperacao = create_access_token(
            identity=id_usuario, expires_delta=timedelta(hours=1),
            additional_claims={'tipo': 'recuperacao_senha'},
        )
    corpo = {'nova_senha': 'outraSenha1'}

    assert client.post('/api/auth/redefinir-senha', headers=_bearer(recuperacao), json=corpo).status_code == 200

    assert client.post('/api/auth/redefinir-senha', headers=_bearer(recuperacao), json=corpo).status_code == 401
    assert em_outra_instancia('POST', '/api/auth/redefinir-senha', recuperacao, corpo) == 401


def test_revogar_apaga_os_revogados_ja_expirados(pg):
    repo = AcessoRepository()
    vencido, vigente = f'jti-{uuid.uuid4()}', f'jti-{uuid.uuid4()}'
    agora = datetime.now(timezone.utc)
    repo.revogar(vencido, agora - timedelta(seconds=1))
    assert repo.revogado(vencido)

    repo.revogar(vigente, agora + timedelta(hours=1))

    assert not repo.revogado(vencido)
    assert repo.revogado(vigente)
    banco.executar('DELETE FROM access_tokens_revogados WHERE jti = %s', (vigente,))



def test_token_de_usuario_apagado_da_401_em_qualquer_rota_autenticada(client, entrar):
    id_usuario, access, refresh = entrar()
    assert client.get('/api/auth/me', headers=_bearer(access)).status_code == 200

    banco.executar('DELETE FROM usuarios WHERE id_usuario = %s', (id_usuario,))

    me = client.get('/api/auth/me', headers=_bearer(access))
    adicionar = client.post('/api/lista/adicionar', headers=_bearer(access), json={
        'id_midia': str(uuid.uuid4()), 'status_consumo': 'planejado',
    })
    assert (me.status_code, adicionar.status_code) == (401, 401)
    # O app tenta renovar e também é recusado: volta ao login.
    assert client.post('/api/auth/refresh', json={'refresh_token': refresh}).status_code == 401


def test_token_com_identidade_que_nao_e_uuid_da_401(client, pg, app):
    with app.app_context():
        token = create_access_token(identity='USR-NAO-E-UUID')

    assert client.get('/api/auth/me', headers=_bearer(token)).status_code == 401
