"""Email sem diferença de caixa, espaços e invisíveis, contra o PostgreSQL real (spec `login-ux`).

Registro, login, esqueci-senha e `redefinir_senha.py` normalizam o email que recebem, e o
banco recusa o mesmo email em outra caixa.

Usa TEST_DATABASE_URL (usuário da aplicação, schema migrado); sem ela, pula.
"""
import os
import uuid

import psycopg
import pytest

import banco
import redefinir_senha
from repositories import AcessoRepository, RefreshTokenRepository
from routes import auth as auth_routes

TEST_DATABASE_URL = os.getenv('TEST_DATABASE_URL')

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para o email normalizado'
)

SENHA = 'segredo1'


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
def email():
    return f'normalizado-{uuid.uuid4().hex}@exemplo.test'


def _registrar(client, pg, email):
    resposta = client.post('/api/auth/registro', json={
        'nome_completo': 'Email Normalizado', 'email': email, 'senha': SENHA,
    })
    if resposta.status_code == 201:
        pg.append(resposta.get_json()['id_usuario'])
    return resposta


def _variantes(email):
    return [
        email.upper(),
        f'  {email.capitalize()} ',
        f'\u00a0{email}\u00a0',
        f'\u200b{email}\u200d',
        f'\ufeff{email[:5]}\u2060{email[5:].upper()}',
    ]


def test_registro_grava_o_email_normalizado(client, pg, email):
    assert _registrar(client, pg, f' \u200b{email.upper()}\u00a0').status_code == 201

    [gravado] = banco.consultar('SELECT email FROM usuarios WHERE id_usuario = %s', (pg[0],))
    assert gravado['email'] == email


@pytest.mark.parametrize('variante', range(5))
def test_login_aceita_o_email_em_outra_caixa_com_espacos_e_invisiveis(client, pg, email, variante):
    assert _registrar(client, pg, email).status_code == 201

    resposta = client.post('/api/auth/login', json={'email': _variantes(email)[variante], 'senha': SENHA})

    assert resposta.status_code == 200
    assert resposta.get_json()['usuario']['email'] == email


@pytest.mark.parametrize('variante', range(5))
def test_registro_do_mesmo_email_em_outra_forma_e_conflito(client, pg, email, variante):
    assert _registrar(client, pg, email).status_code == 201

    resposta = _registrar(client, pg, _variantes(email)[variante])

    assert resposta.status_code == 409
    assert resposta.get_json()['codigo'] == 'conflito'


def test_banco_recusa_o_mesmo_email_em_outra_caixa(pg, email):
    """O índice único em lower(email) vale mesmo para quem grava sem passar pela API."""
    banco.executar("INSERT INTO usuarios (nome_completo, email, senha_hash) VALUES ('A', %s, 'x')", (email,))
    pg.extend(linha['id_usuario'] for linha in banco.consultar(
        'SELECT id_usuario FROM usuarios WHERE email = %s', (email,)))

    with pytest.raises(banco.Conflito):
        banco.executar("INSERT INTO usuarios (nome_completo, email, senha_hash) VALUES ('B', %s, 'x')",
                       (email.upper(),))


def test_esqueci_senha_acha_o_usuario_em_outra_caixa(client, pg, email, caplog):
    assert _registrar(client, pg, email).status_code == 201

    with caplog.at_level('INFO', logger=auth_routes.logger.name):
        resposta = client.post('/api/auth/esqueci-senha', json={'email': f'\u200b {email.upper()}'})

    assert resposta.status_code == 200
    # Fora de produção o token de recuperação sai no log: o Usuário foi achado.
    assert f'Token de recuperação para {pg[0]}' in caplog.text


@pytest.mark.parametrize('variante', range(5))
def test_redefinir_senha_acha_o_usuario_em_outra_caixa(client, pg, email, variante, capsys):
    assert _registrar(client, pg, email).status_code == 201

    codigo = redefinir_senha.main([_variantes(email)[variante]])
    saida = capsys.readouterr()

    assert codigo == 0
    temporaria = saida.out.strip()
    assert email in saida.err
    login = client.post('/api/auth/login', json={'email': email, 'senha': temporaria})
    assert login.status_code == 200
    assert login.get_json()['deve_trocar_senha'] is True


def test_redefinir_senha_de_email_inexistente_nao_muda_nada(pg, capsys):
    assert redefinir_senha.main([f'\u200b NINGUEM-{uuid.uuid4().hex}@exemplo.test']) == 1


def test_indice_unico_e_em_lower_email(pg):
    with psycopg.connect(TEST_DATABASE_URL) as conn:
        definicoes = [linha[0] for linha in conn.execute(
            "SELECT indexdef FROM pg_indexes WHERE tablename = 'usuarios' AND indexdef ILIKE '%%email%%'"
        )]
    assert definicoes == [
        'CREATE UNIQUE INDEX uq_usuarios_email_lower ON public.usuarios USING btree (lower(email))'
    ]
