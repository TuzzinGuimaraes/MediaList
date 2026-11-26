"""Push das Notícias pelo Expo Push Service, com o cliente HTTP e o banco falsos."""
import logging

import pytest
import requests

import avisos_push

from .helpers import FakeBanco, FakeExpo


def _token(i):
    return f'ExponentPushToken[tk{i:04d}]'


def _mensagens(n):
    return [{'to': _token(i), 'title': 'T', 'body': 'B'} for i in range(n)]


def test_envia_em_lotes_de_100_para_o_expo_com_timeout_curto():
    expo = FakeExpo()

    invalidos = avisos_push.enviar(_mensagens(250), expo)

    assert invalidos == []
    assert [len(lote) for _, lote, _, _ in expo.requisicoes] == [100, 100, 50]
    assert {url for url, _, _, _ in expo.requisicoes} == {'https://exp.host/--/api/v2/push/send'}
    assert all(timeout <= avisos_push.TIMEOUT_SEGUNDOS for _, _, _, timeout in expo.requisicoes)
    assert expo.tokens == [_token(i) for i in range(250)]


def test_devolve_os_tokens_device_not_registered_de_todos_os_lotes():
    expo = FakeExpo(nao_registrados={_token(3), _token(150)})

    assert avisos_push.enviar(_mensagens(200), expo) == [_token(3), _token(150)]


def test_ticket_com_details_fora_do_formato_nao_interrompe_o_lote():
    """`details` que não é objeto conta como erro desconhecido; o token inválido do lado ainda sai."""

    class ExpoEstranho(FakeExpo):
        def post(self, url, json=None, headers=None, timeout=None):
            resposta = super().post(url, json=json, headers=headers, timeout=timeout)
            resposta._corpo['data'][0] = {'status': 'error', 'details': 'texto'}
            return resposta

    expo = ExpoEstranho(nao_registrados={_token(1)})

    assert avisos_push.enviar(_mensagens(2), expo) == [_token(1)]


def test_access_token_do_expo_vai_no_cabecalho_so_quando_configurado(monkeypatch):
    monkeypatch.delenv('EXPO_ACCESS_TOKEN', raising=False)
    sem = FakeExpo()
    avisos_push.enviar(_mensagens(1), sem)
    monkeypatch.setenv('EXPO_ACCESS_TOKEN', 'segredo')
    com = FakeExpo()
    avisos_push.enviar(_mensagens(1), com)

    assert 'Authorization' not in sem.requisicoes[0][2]
    assert sem.requisicoes[0][2]['Content-Type'] == 'application/json'
    assert com.requisicoes[0][2]['Authorization'] == 'Bearer segredo'


def test_prazo_total_vencido_para_de_enviar(monkeypatch):
    agora = [0.0]
    monkeypatch.setattr(avisos_push, 'relogio', lambda: agora[0])

    class ExpoLento(FakeExpo):
        def post(self, *args, **kwargs):
            agora[0] += 6
            return super().post(*args, **kwargs)

    expo = ExpoLento()

    avisos_push.enviar(_mensagens(500), expo, prazo=8)

    assert len(expo.requisicoes) == 2
    # A 2ª requisição só tem os 2 s que sobram do prazo.
    assert expo.requisicoes[1][3] == pytest.approx(2)


@pytest.mark.parametrize('falha', [
    requests.Timeout('demorou'),
    (500, {'errors': [{'code': 'INTERNAL_SERVER_ERROR', 'message': 'x'}]}),
    (200, ValueError('não é JSON')),
    (200, {'data': 'estranho'}),
])
def test_falha_do_expo_vai_so_para_o_log_e_sem_tokens(falha, caplog):
    expo = FakeExpo(falha=falha)

    with caplog.at_level(logging.WARNING, logger='avisos_push'):
        invalidos = avisos_push.enviar(_mensagens(150), expo)

    assert invalidos == []
    assert len(expo.requisicoes) == 2
    assert caplog.records
    assert 'ExponentPushToken' not in caplog.text


def test_mensagem_da_noticia_tem_titulo_corpo_curto_e_o_id():
    [mensagem] = avisos_push.mensagens_da_noticia([_token(1)], 'NOT-1', 'Temporada nova', 'Texto  com\n espaços ' * 40)

    assert mensagem['to'] == _token(1)
    assert mensagem['title'] == 'Temporada nova'
    assert mensagem['data'] == {'tipo': 'noticia', 'id_noticia': 'NOT-1'}
    assert len(mensagem['body']) <= avisos_push.CORPO_MAX
    assert mensagem['body'].startswith('Texto com espaços Texto')
    assert mensagem['body'].endswith('…')


def test_noticia_sem_conteudo_tem_corpo_padrao():
    [mensagem] = avisos_push.mensagens_da_noticia([_token(1)], 'NOT-1', 'Só título', '  ')

    assert mensagem['body'] == 'Nova Notícia no MediaList'


def _banco(monkeypatch, tokens):
    fake = FakeBanco({'FROM push_tokens': [{'token': t} for t in tokens]})
    return fake.instalar(monkeypatch, avisos_push)


def test_avisar_noticia_envia_aos_tokens_de_quem_quer_aviso_menos_o_autor(monkeypatch):
    fake = _banco(monkeypatch, [_token(1), _token(2)])
    expo = FakeExpo(nao_registrados={_token(2)})
    monkeypatch.setattr(avisos_push, 'criar_cliente', lambda: expo)

    avisos_push.avisar_noticia('NOT-1', 'Título', 'Texto', 'AUTOR')

    [(_, sql, params)] = fake.sql('SELECT pt.token')
    assert 'avisar_noticias' in sql and 'ativo' in sql and '<> %s' in sql
    assert params == ('AUTOR',)
    assert expo.tokens == [_token(1), _token(2)]
    assert expo.fechado
    [(_, _, params)] = fake.sql('DELETE FROM push_tokens')
    assert params == ([_token(2)],)


def test_avisar_noticia_sem_tokens_nao_chama_o_expo(monkeypatch):
    _banco(monkeypatch, [])
    monkeypatch.setattr(avisos_push, 'criar_cliente', lambda: pytest.fail('não devia criar o cliente'))

    avisos_push.avisar_noticia('NOT-1', 'Título', 'Texto', 'AUTOR')


def test_avisar_noticia_nao_levanta_quando_o_banco_falha(monkeypatch, caplog):
    FakeBanco({'FROM push_tokens': RuntimeError('banco fora')}).instalar(monkeypatch, avisos_push)

    with caplog.at_level(logging.WARNING, logger='avisos_push'):
        avisos_push.avisar_noticia('NOT-1', 'Título', 'Texto', 'AUTOR')

    assert 'NOT-1' in caplog.text


@pytest.mark.parametrize('token,valido', [
    ('ExponentPushToken[abc-123_XYZ]', True),
    ('ExpoPushToken[abc]', True),
    ('ExponentPushToken[]', False),
    ('ExponentPushToken[a b]', False),
    ('ExponentPushToken[abc]x', False),
    ('fcm-token-cru', False),
])
def test_formato_do_token(token, valido):
    assert bool(avisos_push.FORMATO_TOKEN.fullmatch(token)) is valido
