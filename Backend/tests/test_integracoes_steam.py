"""Plataforma Steam e casamento no RAWG, com sessões HTTP falsas (nada de rede)."""
import logging

import pytest
import requests

from integracoes import steam as modulo_steam
from integracoes.plataforma import Conta, OrigemIndisponivel, PerfilNaoEncontrado, PerfilPrivado
from integracoes.rawg import Rawg
from integracoes.steam import Steam, horas_de

from .fontes_falsas import (
    CHAVE_RAWG,
    CHAVE_STEAM,
    STEAMID,
    Resposta,
    SessaoGet,
    jogo_steam,
    resultado_rawg,
    rotas_steam,
)


def _steam(rotas, chave=CHAVE_STEAM):
    sessao = SessaoGet(rotas)
    return Steam(sessao=sessao, chave=chave), sessao


# ============================================
# Conectar
# ============================================

@pytest.mark.parametrize('identificador', [
    STEAMID,
    f'https://steamcommunity.com/profiles/{STEAMID}/',
    f'steamcommunity.com/profiles/{STEAMID}?l=portuguese',
    'https://steamcommunity.com/id/fulano/',
    'steamcommunity.com/id/fulano',
    ' fulano ',
])
def test_conecta_por_steamid64_url_de_perfil_ou_vanity(identificador):
    steam, sessao = _steam(rotas_steam([], vanity={'fulano': STEAMID}))

    conta = steam.conectar(identificador)

    assert conta == Conta(STEAMID, 'Fulano')
    assert all(p['key'] == CHAVE_STEAM for _, p in sessao.chamadas)


def test_vanity_inexistente_e_perfil_nao_encontrado():
    steam, _ = _steam(rotas_steam([]))
    with pytest.raises(PerfilNaoEncontrado):
        steam.conectar('steamcommunity.com/id/ninguem')


@pytest.mark.parametrize('identificador', ['', 'https://exemplo.com/x y', 'a'])
def test_identificador_invalido_e_perfil_nao_encontrado_sem_chamar_a_api(identificador):
    steam, sessao = _steam({})
    with pytest.raises(PerfilNaoEncontrado):
        steam.conectar(identificador)
    assert sessao.chamadas == []


def test_steamid_sem_jogador_e_perfil_nao_encontrado():
    steam, _ = _steam({r'GetPlayerSummaries': {'response': {'players': []}}})
    with pytest.raises(PerfilNaoEncontrado):
        steam.conectar(STEAMID)


def test_perfil_privado_da_erro_com_o_passo_para_torna_lo_publico():
    steam, _ = _steam(rotas_steam([], visibilidade=1))
    with pytest.raises(PerfilPrivado, match='Público'):
        steam.conectar(STEAMID)


def test_detalhes_de_jogo_privados_devolvem_vazio_e_dao_perfil_privado():
    steam, _ = _steam(rotas_steam(privado_jogos=True))
    with pytest.raises(PerfilPrivado, match='Detalhes dos jogos'):
        steam.conectar(STEAMID)


@pytest.mark.parametrize('falha', [
    Resposta(403, {}), Resposta(500, {}), Resposta(429, {}),
    requests.ConnectionError('falhou'), Resposta(200, ValueError('não é JSON')),
])
def test_steam_fora_do_ar_e_origem_indisponivel(falha):
    steam, _ = _steam({r'GetPlayerSummaries': falha})
    with pytest.raises(OrigemIndisponivel):
        steam.conectar(STEAMID)


def test_sem_chave_fica_indisponivel():
    assert Steam(chave='').disponivel() is False
    assert Steam(chave=CHAVE_STEAM).disponivel() is True


def test_chave_da_steam_nao_vai_para_o_log_quando_a_requisicao_falha(caplog):
    erro = requests.ConnectionError(
        f'HTTPSConnectionPool: Max retries exceeded with url: /ISteamUser/GetPlayerSummaries/v2/?key={CHAVE_STEAM}'
    )
    steam, _ = _steam({r'GetPlayerSummaries': erro})

    with caplog.at_level(logging.DEBUG), pytest.raises(OrigemIndisponivel) as excinfo:
        steam.conectar(STEAMID)

    assert caplog.records
    assert all(CHAVE_STEAM not in r.getMessage() for r in caplog.records)
    assert CHAVE_STEAM not in str(excinfo.value)
    assert excinfo.value.__cause__ is None


# ============================================
# Ler
# ============================================

@pytest.mark.parametrize(('minutos', 'horas'), [
    (0, 0), (None, 0), (-5, 0), (1, 1), (29, 1), (30, 1), (89, 1), (90, 2), (6000, 100),
])
def test_horas_sao_minutos_sobre_60_arredondados_com_ao_menos_1_se_jogou(minutos, horas):
    assert horas_de(minutos) == horas


def test_le_todo_jogo_ja_aberto_e_a_data_da_ultima_vez():
    steam, sessao = _steam(rotas_steam([
        jogo_steam(10, 'Counter-Strike', 125, 1_764_000_000),
        jogo_steam(20, 'Nunca aberto', 0),
        jogo_steam(30, 'Dez minutos', 10),
        jogo_steam(40, 'Sem data', 600, 0),
    ]))

    itens = steam.ler(Conta(STEAMID, 'Fulano'))

    assert [(i.origem_id, i.titulo, i.horas, i.jogado_em) for i in itens] == [
        ('10', 'Counter-Strike', 2, '2025-11-24'),
        ('30', 'Dez minutos', 1, None),
        ('40', 'Sem data', 10, None),
    ]
    assert itens[0].tipo == 'jogo'
    assert itens[0].link == 'https://store.steampowered.com/app/10'
    assert itens[0].catalogo is None and itens[0].progresso is None
    _, params = next(c for c in sessao.chamadas if 'GetOwnedGames' in c[0])
    assert params['steamid'] == STEAMID
    assert params['include_appinfo'] and params['include_played_free_games']


def test_ler_com_detalhes_privados_e_perfil_privado():
    steam, _ = _steam(rotas_steam(privado_jogos=True))
    with pytest.raises(PerfilPrivado):
        steam.ler(Conta(STEAMID))


# ============================================
# Casamento no RAWG
# ============================================

def _rawg(rotas):
    sessao = SessaoGet(rotas)
    return Rawg(sessao=sessao, chave=CHAVE_RAWG), sessao


def test_casa_so_quando_a_loja_steam_tem_o_mesmo_appid():
    rawg, sessao = _rawg({
        r'/games$': {'results': [
            resultado_rawg('portal-falso', 'Portal', lojas=('steam',)),
            resultado_rawg('portal', 'Portal', lojas=('steam', 'xbox-store')),
        ]},
        r'/games/portal-falso/stores$': {'results': [{'url': 'https://store.steampowered.com/app/4000/'}]},
        r'/games/portal/stores$': {'results': [
            {'url': 'https://www.xbox.com/x'}, {'url': 'https://store.steampowered.com/app/400/Portal/'},
        ]},
    })

    assert rawg.casar(400, 'Portal') == 'portal'
    _, params = sessao.chamadas[0]
    assert params['search'] == 'Portal' and params['key'] == CHAVE_RAWG


def test_resultado_sem_a_loja_steam_nem_e_consultado():
    rawg, sessao = _rawg({
        r'/games$': {'results': [resultado_rawg('halo', 'Halo', lojas=('xbox-store',))]},
    })

    assert rawg.casar(976730, 'Halo') is None
    assert len(sessao.chamadas) == 1


def test_sem_resultado_nao_casa():
    rawg, _ = _rawg({r'/games$': {'results': []}})
    assert rawg.casar(1, 'Obscuro') is None


@pytest.mark.parametrize('falha', [Resposta(502, {}), requests.ConnectionError('fora')])
def test_rawg_fora_do_ar_e_origem_indisponivel_e_a_chave_nao_vaza(falha, caplog):
    if isinstance(falha, Exception):
        falha = requests.ConnectionError(f'falhou em /api/games?key={CHAVE_RAWG}&search=x')
    rawg, _ = _rawg({r'/games$': falha})

    with caplog.at_level(logging.DEBUG), pytest.raises(OrigemIndisponivel):
        rawg.casar(1, 'x')

    assert all(CHAVE_RAWG not in r.getMessage() for r in caplog.records)


def test_rawg_sem_chave_fica_indisponivel():
    assert Rawg(chave='').disponivel() is False


def test_steam_usa_a_chave_do_ambiente(monkeypatch):
    monkeypatch.setattr(modulo_steam, 'STEAM_API_KEY', 'do-ambiente')
    assert Steam().disponivel() is True
    monkeypatch.setattr(modulo_steam, 'STEAM_API_KEY', '')
    assert Steam().disponivel() is False
