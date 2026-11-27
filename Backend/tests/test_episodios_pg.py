"""Job de episódios (spec `episodio-novo`): AniList falso, Expo falso e o PostgreSQL real.

Roda o `main` do job como o workflow, de uma resposta do `airingSchedule` e do Catálogo, e
confere o que fica gravado (Atualização, Notificações, anime, cursor) e quem recebe push.
Usa TEST_DATABASE_URL; sem ela, pula.
"""
import os
import uuid
from datetime import UTC, datetime, timedelta

import pytest

import avisos_push
import banco
from repositories import Catalogo

from .fontes_falsas import AiringFalso, anime_anilist, exibicao
from .helpers import FakeExpo

TEST_DATABASE_URL = os.getenv('TEST_DATABASE_URL')

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para o job de episódios'
)

AGORA = datetime(2026, 11, 27, 12, 0, tzinfo=UTC)
HORA = 3600


def _epoch(instante):
    return int(instante.timestamp())


class _SemEspera:
    def __init__(self, *args):
        pass

    def wait(self):
        pass


@pytest.fixture
def cursor_limpo(pg):
    banco.executar('DELETE FROM episodios_cursor')
    yield
    banco.executar('DELETE FROM episodios_cursor')


@pytest.fixture
def expo(monkeypatch):
    falso = FakeExpo()
    monkeypatch.setattr(avisos_push, 'criar_cliente', lambda: falso)
    return falso


@pytest.fixture
def rodar(cursor_limpo, monkeypatch):
    """Roda o job contra o AniList falso no instante `agora`; devolve o código de saída."""
    from importacao import episodios

    monkeypatch.setattr(episodios, 'RateLimiter', _SemEspera)

    def _rodar(fonte, agora=AGORA):
        monkeypatch.setattr(episodios, 'criar_sessao_http', lambda **kw: fonte)
        monkeypatch.setattr(episodios, 'relogio', lambda: agora)
        return episodios.main()

    return _rodar


def _anime(pg, anilist_id=None, titulo='Anime PG', **campos):
    id_midia = Catalogo().criar('anime', {'titulo_original': f'PG {uuid.uuid4().hex}', 'titulo_romaji': titulo,
                                          **campos})
    pg['midias'].append(id_midia)
    anilist_id = anilist_id or 880000 + uuid.uuid4().int % 100000
    banco.executar('UPDATE animes SET anilist_id = %s WHERE id_midia = %s', (anilist_id, id_midia))
    return id_midia, anilist_id


def _usuario(pg, avisar_episodios=True, token=True):
    id_usuario = banco.consultar_um(
        "INSERT INTO usuarios (nome_completo, email, senha_hash, avisar_episodios) VALUES ('PG', %s, 'x', %s) "
        'RETURNING id_usuario',
        (f'pg-{uuid.uuid4().hex}@exemplo.test', avisar_episodios),
    )['id_usuario']
    pg['usuarios'].append(id_usuario)
    if token:
        banco.executar("INSERT INTO push_tokens (token, id_usuario, plataforma) VALUES (%s, %s, 'android')",
                       (f'ExponentPushToken[{uuid.uuid4().hex}]', id_usuario))
    return id_usuario


def _tokens(id_usuario):
    return {linha['token'] for linha in banco.consultar('SELECT token FROM push_tokens WHERE id_usuario = %s',
                                                         (id_usuario,))}


def _na_lista(id_usuario, id_midia, status, favorito=False):
    banco.executar(
        'INSERT INTO lista_usuarios (id_usuario, id_midia, status_consumo, favorito) VALUES (%s, %s, %s, %s)',
        (id_usuario, id_midia, status, favorito),
    )


def _notificados(id_midia, episodio):
    return {linha['id_usuario'] for linha in banco.consultar(
        "SELECT n.id_usuario FROM notificacoes n JOIN atualizacoes_midia a USING (id_atualizacao) "
        "WHERE a.id_midia = %s AND a.tipo_atualizacao = 'episodio' AND a.dados_adicionais->>'episodio' = %s",
        (id_midia, str(episodio)),
    )}


def _atualizacoes(id_midia):
    return banco.consultar(
        'SELECT tipo_atualizacao, titulo, dados_adicionais FROM atualizacoes_midia WHERE id_midia = %s '
        "ORDER BY dados_adicionais->>'episodio'",
        (id_midia,),
    )


def _cursor():
    linha = banco.consultar_um('SELECT exibido_ate FROM episodios_cursor')
    return linha and linha['exibido_ate']


def _mensagens(expo, id_usuario):
    tokens = _tokens(id_usuario)
    return [m for _, lote, _, _ in expo.requisicoes for m in lote if m['to'] in tokens]


def _ha(minutos):
    return _epoch(AGORA - timedelta(minutes=minutos))


def test_estreia_vai_a_assistindo_planejado_e_favorito(pg, rodar, expo):
    id_midia, anilist_id = _anime(pg, titulo='Frieren')
    usuarios = {s: _usuario(pg) for s in ('assistindo', 'planejado', 'pausado', 'abandonado', 'completo')}
    favorito_pausado = _usuario(pg)
    for status, id_usuario in usuarios.items():
        _na_lista(id_usuario, id_midia, status)
    _na_lista(favorito_pausado, id_midia, 'pausado', favorito=True)

    codigo = rodar(AiringFalso([exibicao(anilist_id, 1, _ha(30))]))

    assert codigo == 0
    assert _notificados(id_midia, 1) == {usuarios['assistindo'], usuarios['planejado'], favorito_pausado}
    [atualizacao] = _atualizacoes(id_midia)
    assert atualizacao['tipo_atualizacao'] == 'episodio'
    assert atualizacao['titulo'] == 'Episódio 1 de Frieren foi ao ar'
    assert atualizacao['dados_adicionais'] == {
        'episodio': 1, 'exibido_em': (AGORA - timedelta(minutes=30)).isoformat(),
    }


def test_push_e_atualizacao_usam_o_titulo_em_ingles_e_caem_para_o_romaji(pg, rodar, expo):
    com_ingles, anilist_ingles = _anime(pg, titulo='Sousou no Frieren', titulo_ingles="Frieren: Beyond Journey's End")
    sem_ingles, anilist_romaji = _anime(pg, titulo='Kusuriya no Hitorigoto', titulo_ingles='')
    assistindo = _usuario(pg)
    _na_lista(assistindo, com_ingles, 'assistindo')
    _na_lista(assistindo, sem_ingles, 'assistindo')

    rodar(AiringFalso([exibicao(anilist_ingles, 3, _ha(30)), exibicao(anilist_romaji, 3, _ha(20))]))

    assert [a['titulo'] for a in _atualizacoes(com_ingles)] == ["Episódio 3 de Frieren: Beyond Journey's End foi ao ar"]
    assert [a['titulo'] for a in _atualizacoes(sem_ingles)] == ['Episódio 3 de Kusuriya no Hitorigoto foi ao ar']
    assert sorted(m['title'] for m in _mensagens(expo, assistindo)) == [
        "Frieren: Beyond Journey's End", 'Kusuriya no Hitorigoto',
    ]


def test_episodio_2_em_diante_vai_so_a_assistindo_e_favorito(pg, rodar, expo):
    id_midia, anilist_id = _anime(pg)
    assistindo, planejado, favorito, pausado = (_usuario(pg) for _ in range(4))
    _na_lista(assistindo, id_midia, 'assistindo')
    _na_lista(planejado, id_midia, 'planejado')
    _na_lista(favorito, id_midia, 'completo', favorito=True)
    _na_lista(pausado, id_midia, 'pausado')

    rodar(AiringFalso([exibicao(anilist_id, 2, _ha(30))]))

    assert _notificados(id_midia, 2) == {assistindo, favorito}


def test_rodar_de_novo_a_mesma_janela_nao_duplica_atualizacao_notificacao_nem_push(pg, rodar, expo):
    id_midia, anilist_id = _anime(pg)
    assistindo = _usuario(pg)
    _na_lista(assistindo, id_midia, 'assistindo')
    fonte = AiringFalso([exibicao(anilist_id, 5, _ha(30))])

    rodar(fonte)
    banco.executar('DELETE FROM episodios_cursor')  # a próxima execução refaz a mesma janela
    segunda = rodar(fonte)

    assert segunda == 0
    assert len(_atualizacoes(id_midia)) == 1
    assert _notificados(id_midia, 5) == {assistindo}
    assert len(_mensagens(expo, assistindo)) == 1


def test_anime_fora_do_catalogo_e_ignorado(pg, rodar, expo):
    id_midia, anilist_id = _anime(pg)
    assistindo = _usuario(pg)
    _na_lista(assistindo, id_midia, 'assistindo')

    codigo = rodar(AiringFalso([exibicao(anilist_id + 1, 3, _ha(30)), exibicao(anilist_id, 3, _ha(20))]))

    assert codigo == 0
    assert len(_atualizacoes(id_midia)) == 1
    assert _cursor() == AGORA


def test_anime_e_atualizado_com_status_total_lancados_e_proximo(pg, rodar, expo):
    id_midia, anilist_id = _anime(pg, status_anime='aguardando', numero_episodios=None)
    proximo = AGORA + timedelta(days=7)

    rodar(AiringFalso([exibicao(anilist_id, 4, _ha(30), status='RELEASING', episodios=24,
                                proximo=(5, _epoch(proximo)))]))

    linha = banco.consultar_um(
        'SELECT status_anime, numero_episodios, episodios_lancados, proximo_episodio_em FROM animes '
        'WHERE id_midia = %s', (id_midia,),
    )
    assert linha == {'status_anime': 'em_exibicao', 'numero_episodios': 24, 'episodios_lancados': 4,
                     'proximo_episodio_em': proximo}


def test_ultimo_episodio_finaliza_e_total_desconhecido_nao_apaga_o_que_havia(pg, rodar, expo):
    id_midia, anilist_id = _anime(pg, status_anime='em_exibicao', numero_episodios=12)
    banco.executar("UPDATE animes SET proximo_episodio_em = now() WHERE id_midia = %s", (id_midia,))

    rodar(AiringFalso([exibicao(anilist_id, 12, _ha(30), status='FINISHED', episodios=None)]))

    linha = banco.consultar_um(
        'SELECT status_anime, numero_episodios, episodios_lancados, proximo_episodio_em FROM animes '
        'WHERE id_midia = %s', (id_midia,),
    )
    assert linha == {'status_anime': 'finalizado', 'numero_episodios': 12, 'episodios_lancados': 12,
                     'proximo_episodio_em': None}


def test_primeira_execucao_le_a_ultima_hora_e_grava_o_cursor(pg, rodar, expo):
    id_midia, anilist_id = _anime(pg)
    fonte = AiringFalso([exibicao(anilist_id, 1, _ha(90)), exibicao(anilist_id, 2, _ha(30))])

    rodar(fonte)

    assert [a['dados_adicionais']['episodio'] for a in _atualizacoes(id_midia)] == [2]
    assert (fonte.pedidos[0]['depois'], fonte.pedidos[0]['antes']) == (_epoch(AGORA) - HORA, _epoch(AGORA) + 1)
    assert _cursor() == AGORA


def test_execucao_seguinte_parte_do_cursor_e_recupera_a_janela_perdida(pg, rodar, expo):
    id_midia, anilist_id = _anime(pg)
    banco.executar('INSERT INTO episodios_cursor (exibido_ate) VALUES (%s)', (AGORA - timedelta(days=3),))
    fonte = AiringFalso([
        exibicao(anilist_id, 1, _epoch(AGORA - timedelta(days=3))),  # já lido (o cursor é inclusivo)
        exibicao(anilist_id, 2, _epoch(AGORA - timedelta(days=2))),
        exibicao(anilist_id, 3, _ha(1)),
        exibicao(anilist_id, 4, _epoch(AGORA + timedelta(minutes=1))),  # ainda não foi ao ar
    ])

    rodar(fonte)

    assert [a['dados_adicionais']['episodio'] for a in _atualizacoes(id_midia)] == [2, 3]
    assert _cursor() == AGORA


def test_janela_nunca_comeca_antes_de_7_dias(pg, rodar, expo):
    id_midia, anilist_id = _anime(pg)
    banco.executar('INSERT INTO episodios_cursor (exibido_ate) VALUES (%s)', (AGORA - timedelta(days=10),))
    fonte = AiringFalso([
        exibicao(anilist_id, 1, _epoch(AGORA - timedelta(days=8))),
        exibicao(anilist_id, 2, _epoch(AGORA - timedelta(days=6))),
    ])

    rodar(fonte)

    assert fonte.pedidos[0]['depois'] == _epoch(AGORA - timedelta(days=7))
    assert [a['dados_adicionais']['episodio'] for a in _atualizacoes(id_midia)] == [2]


def test_pagina_o_airing_schedule_ate_o_fim_da_janela(pg, rodar, expo, monkeypatch):
    from importacao import episodios

    monkeypatch.setattr(episodios, 'POR_PAGINA', 2)
    id_midia, anilist_id = _anime(pg)
    fonte = AiringFalso([exibicao(anilist_id, n, _ha(50 - n)) for n in range(1, 6)])

    rodar(fonte)

    assert [p['page'] for p in fonte.pedidos] == [1, 2, 3]
    assert {p['perPage'] for p in fonte.pedidos} == {2}
    assert len(_atualizacoes(id_midia)) == 5
    consulta = fonte.consultas[0]
    assert 'airingSchedules(airingAt_greater: $depois, airingAt_lesser: $antes' in consulta
    assert 'nextAiringEpisode { episode airingAt }' in consulta


def test_janela_que_passa_da_ultima_pagina_para_no_ultimo_instante_lido(pg, rodar, expo, monkeypatch):
    from importacao import episodios

    monkeypatch.setattr(episodios, 'POR_PAGINA', 2)
    monkeypatch.setattr(episodios, 'ULTIMA_PAGINA', 2)
    id_midia, anilist_id = _anime(pg)
    instantes = [_ha(50), _ha(40), _ha(30), _ha(30), _ha(20)]
    fonte = AiringFalso([exibicao(anilist_id, n, t) for n, t in enumerate(instantes, start=1)])

    rodar(fonte)

    # A página 2 termina no episódio 4 (há 30 min), mas o 3 tem o mesmo instante: o cursor fica
    # um segundo antes, e a próxima execução lê os dois de novo (o índice único evita duplicata).
    assert [p['page'] for p in fonte.pedidos] == [1, 2]
    assert [a['dados_adicionais']['episodio'] for a in _atualizacoes(id_midia)] == [1, 2]
    assert _cursor() == AGORA - timedelta(minutes=30, seconds=1)

    rodar(fonte)

    assert [a['dados_adicionais']['episodio'] for a in _atualizacoes(id_midia)] == [1, 2, 3, 4, 5]
    assert _cursor() == AGORA


def test_falha_do_anilist_nao_grava_nem_avanca_o_cursor(pg, rodar, expo, monkeypatch):
    from importacao import episodios

    monkeypatch.setattr(episodios, 'POR_PAGINA', 1)
    id_midia, anilist_id = _anime(pg)
    banco.executar('INSERT INTO episodios_cursor (exibido_ate) VALUES (%s)', (AGORA - timedelta(hours=2),))
    fonte = AiringFalso([exibicao(anilist_id, 1, _ha(90)), exibicao(anilist_id, 2, _ha(30))], falha_em={2})

    codigo = rodar(fonte)

    assert codigo == 1
    assert _atualizacoes(id_midia) == []
    assert _cursor() == AGORA - timedelta(hours=2)


def test_push_ate_dois_episodios_um_por_episodio_e_tres_ou_mais_um_so(pg, rodar, expo):
    animes = [_anime(pg, titulo=f'Anime {n}') for n in range(5)]
    um, dois, tres = _usuario(pg), _usuario(pg), _usuario(pg)
    _na_lista(um, animes[0][0], 'assistindo')
    for id_midia, _ in animes[:2]:
        _na_lista(dois, id_midia, 'assistindo')
    for id_midia, _ in animes[2:]:
        _na_lista(tres, id_midia, 'assistindo')

    rodar(AiringFalso([exibicao(anilist_id, 7, _ha(30)) for _, anilist_id in animes]))

    [so_um] = _mensagens(expo, um)
    assert (so_um['title'], so_um['body']) == ('Anime 0', 'Episódio 7 foi ao ar')
    assert so_um['data'] == {'tipo': 'episodio', 'id_midia': str(animes[0][0])}
    assert sorted((m['title'], m['data']['id_midia']) for m in _mensagens(expo, dois)) == [
        ('Anime 0', str(animes[0][0])), ('Anime 1', str(animes[1][0])),
    ]
    [agrupado] = _mensagens(expo, tres)
    assert agrupado['body'] == '3 episódios novos na sua lista'
    assert agrupado['data'] == {'tipo': 'episodios'}


def test_avisar_episodios_desligado_recebe_notificacao_mas_nao_push(pg, rodar, expo):
    id_midia, anilist_id = _anime(pg)
    quer, nao_quer = _usuario(pg), _usuario(pg, avisar_episodios=False)
    for id_usuario in (quer, nao_quer):
        _na_lista(id_usuario, id_midia, 'assistindo')

    rodar(AiringFalso([exibicao(anilist_id, 2, _ha(30))]))

    assert _notificados(id_midia, 2) == {quer, nao_quer}
    assert len(_mensagens(expo, quer)) == 1
    assert _mensagens(expo, nao_quer) == []


def test_token_nao_registrado_e_apagado_pelo_job(pg, rodar, expo):
    id_midia, anilist_id = _anime(pg)
    assistindo = _usuario(pg)
    _na_lista(assistindo, id_midia, 'assistindo')
    [morto] = _tokens(assistindo)
    expo.nao_registrados = {morto}

    codigo = rodar(AiringFalso([exibicao(anilist_id, 2, _ha(30))]))

    assert codigo == 0
    assert _tokens(assistindo) == set()


def test_episodio_invalido_da_fonte_e_ignorado(pg, rodar, expo):
    id_midia, anilist_id = _anime(pg)
    ruins = [exibicao(anilist_id, 0, _ha(40)), exibicao(anilist_id, 'x', _ha(35)),
             {**exibicao(anilist_id, 3, _ha(32)), 'media': None}]

    codigo = rodar(AiringFalso([*ruins, exibicao(anilist_id, 2, _ha(30))]))

    assert codigo == 0
    assert [a['dados_adicionais']['episodio'] for a in _atualizacoes(id_midia)] == [2, 3]



# Situação do anime sem episódio na janela: o que terminou não fica "em exibição".

def _situacao(id_midia):
    return banco.consultar_um(
        'SELECT status_anime, numero_episodios, episodios_lancados, proximo_episodio_em FROM animes '
        'WHERE id_midia = %s', (id_midia,),
    )


def _em_exibicao(pg, proximo_em=None, **campos):
    id_midia, anilist_id = _anime(pg, status_anime='em_exibicao', **campos)
    banco.executar('UPDATE animes SET proximo_episodio_em = %s WHERE id_midia = %s', (proximo_em, id_midia))
    return id_midia, anilist_id


def test_anime_em_exibicao_sem_proximo_que_terminou_fica_finalizado_sem_atualizacao(pg, rodar, expo):
    id_midia, anilist_id = _em_exibicao(pg, numero_episodios=None)
    assistindo = _usuario(pg)
    _na_lista(assistindo, id_midia, 'assistindo')
    fonte = AiringFalso(animes={anilist_id: anime_anilist(anilist_id, status='FINISHED', episodios=12)})

    codigo = rodar(fonte)

    assert codigo == 0
    assert _situacao(id_midia) == {'status_anime': 'finalizado', 'numero_episodios': 12,
                                   'episodios_lancados': 12, 'proximo_episodio_em': None}
    assert _atualizacoes(id_midia) == []
    assert _mensagens(expo, assistindo) == []
    consulta = fonte.consultas_animes[0]
    assert 'media(id_in: $ids' in consulta
    assert 'nextAiringEpisode { episode airingAt }' in consulta


def test_anime_com_proximo_vencido_ha_mais_de_um_dia_e_atualizado(pg, rodar, expo):
    id_midia, anilist_id = _em_exibicao(pg, proximo_em=AGORA - timedelta(days=2), numero_episodios=24)
    proximo = AGORA + timedelta(days=5)
    fonte = AiringFalso(animes={anilist_id: anime_anilist(anilist_id, episodios=24, proximo=(8, _epoch(proximo)))})

    rodar(fonte)

    assert _situacao(id_midia) == {'status_anime': 'em_exibicao', 'numero_episodios': 24,
                                   'episodios_lancados': 7, 'proximo_episodio_em': proximo}


def test_so_consulta_em_exibicao_com_proximo_nulo_ou_vencido_ha_mais_de_um_dia(pg, rodar, expo):
    nulo = _em_exibicao(pg)
    vencido = _em_exibicao(pg, proximo_em=AGORA - timedelta(days=1, minutes=1))
    recente = _em_exibicao(pg, proximo_em=AGORA - timedelta(hours=12))
    futuro = _em_exibicao(pg, proximo_em=AGORA + timedelta(days=1))
    finalizado = _anime(pg, status_anime='finalizado')
    fonte = AiringFalso(animes={a: anime_anilist(a, status='FINISHED') for _, a in
                                (nulo, vencido, recente, futuro, finalizado)})

    rodar(fonte)

    consultados = {i for p in fonte.pedidos_animes for i in p['ids']}
    assert {nulo[1], vencido[1]} <= consultados
    assert not consultados & {recente[1], futuro[1], finalizado[1]}
    assert _situacao(nulo[0])['status_anime'] == 'finalizado'
    assert _situacao(recente[0])['status_anime'] == 'em_exibicao'


def test_anime_com_episodio_na_janela_nao_e_consultado_de_novo(pg, rodar, expo):
    id_midia, anilist_id = _em_exibicao(pg)
    fonte = AiringFalso([exibicao(anilist_id, 3, _ha(30))],
                        animes={anilist_id: anime_anilist(anilist_id, status='FINISHED')})

    rodar(fonte)

    assert anilist_id not in {i for p in fonte.pedidos_animes for i in p['ids']}
    assert _situacao(id_midia)['status_anime'] == 'em_exibicao'


def test_situacao_le_no_maximo_duas_paginas(pg, rodar, expo, monkeypatch):
    from importacao import episodios

    monkeypatch.setattr(episodios, 'POR_PAGINA', 2)
    animes = [_em_exibicao(pg) for _ in range(5)]
    fonte = AiringFalso(animes={a: anime_anilist(a, status='FINISHED') for _, a in animes})

    rodar(fonte)

    assert [p['page'] for p in fonte.pedidos_animes] == [1, 2]
    assert {p['perPage'] for p in fonte.pedidos_animes} == {2}
    [ids] = {tuple(sorted(p['ids'])) for p in fonte.pedidos_animes}
    assert len(ids) == 4
    finalizados = [i for i, _ in animes if _situacao(i)['status_anime'] == 'finalizado']
    assert len(finalizados) == 4


def test_falha_do_anilist_na_situacao_sai_com_1_mas_a_janela_fica_gravada(pg, rodar, expo):
    id_midia, anilist_id = _anime(pg)
    parado, _ = _em_exibicao(pg)
    fonte = AiringFalso([exibicao(anilist_id, 2, _ha(30))], falha_animes=True)

    codigo = rodar(fonte)

    assert codigo == 1
    assert len(_atualizacoes(id_midia)) == 1
    assert _cursor() == AGORA
    assert _situacao(parado)['status_anime'] == 'em_exibicao'
