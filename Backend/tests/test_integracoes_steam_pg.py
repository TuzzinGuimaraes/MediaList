"""Sincronização da Steam com o PostgreSQL real e Steam/RAWG falsos (nada de rede).

`POST /integracoes/steam/sincronizar` (orçamento, pendentes, já casados primeiro), casamento por
`steam_appids` (positivo e negativo, negativo retentado depois de 30 dias), regras da Q111 e o
job diário (`integracoes.job_steam`) sem orçamento e sem vazar as chaves. Sem TEST_DATABASE_URL, pula.
"""
import random
import sys
import uuid

import pytest

import banco
from importacao import utils
from importacao.importar_jogos import processar_e_inserir_jogo
from integracoes import job_steam, repositorio, servico, sincronizacao_steam
from integracoes.loja_steam import LojaSteam
from integracoes.plataforma import Conta
from integracoes.rawg import Rawg
from integracoes.steam import Steam

from .fontes_falsas import (
    CHAVE_RAWG,
    CHAVE_STEAM,
    STEAMID,
    Resposta,
    SessaoGet,
    appdetails,
    detalhe_rawg,
    jogo_steam,
    resultado_rawg,
    rotas_steam,
)
from .test_repositorios_pg import TEST_DATABASE_URL, _usuario, pg  # noqa: F401 (fixture)

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para a Steam'
)

HORA = 1_000_000_000  # rtime_last_played antigo: jogo novo entra como pausado


@pytest.fixture
def limpar(pg):  # noqa: F811
    """appids e slugs do teste: apagados no fim (inclusive as Mídias importadas)."""
    usados = {'appids': [], 'slugs': []}
    yield usados
    banco.executar('DELETE FROM steam_appids WHERE appid = ANY(%s)', (usados['appids'],))
    banco.executar(
        'DELETE FROM midias WHERE id_midia IN '
        '(SELECT id_midia FROM jogos WHERE rawg_slug = ANY(%s) OR steam_appid = ANY(%s))',
        (usados['slugs'], usados['appids']),
    )


@pytest.fixture
def jogo(limpar):
    """Cria (appid, slug, nome) únicos para o teste."""
    def novo(nome='Jogo'):
        appid = random.randint(10**8, 2 * 10**9)
        slug = f'int-steam-{uuid.uuid4().hex[:12]}'
        limpar['appids'].append(appid)
        limpar['slugs'].append(slug)
        return appid, slug, f'{nome} {slug}'

    return novo


@pytest.fixture
def usuario(pg, make_token):  # noqa: F811
    id_usuario = _usuario(pg)
    return id_usuario, {'Authorization': f'Bearer {make_token(id_usuario)}'}


@pytest.fixture
def fontes(monkeypatch):
    """`fontes(jogos_steam, rotas_rawg, loja=rotas_da_loja)` instala a Steam, o RAWG e a loja da
    Steam falsos; devolve a sessão do RAWG (a da loja fica em `.loja`). A loja padrão não tem
    nenhuma appid (`success: false`)."""
    def instalar(jogos, rawg=None, loja=None, **steam):
        monkeypatch.setitem(
            servico.PLATAFORMAS, 'steam', Steam(sessao=SessaoGet(rotas_steam(jogos, **steam)), chave=CHAVE_STEAM),
        )
        sessao_rawg = SessaoGet(rawg or {})
        sessao_rawg.loja = SessaoGet(loja or {r'/api/appdetails': lambda p: {str(p['appids']): {'success': False}}})
        monkeypatch.setattr(sincronizacao_steam, 'Rawg', lambda **kw: Rawg(sessao=sessao_rawg, chave=CHAVE_RAWG, **kw))
        monkeypatch.setattr(sincronizacao_steam, 'LojaSteam', lambda **kw: LojaSteam(sessao=sessao_rawg.loja, **kw))
        return sessao_rawg

    return instalar


def loja_com(*apps):
    """Rotas da loja da Steam com cada `appdetails(...)`; as outras appids voltam `success: false`."""
    respostas = {k: v for app in apps for k, v in app.items()}
    return {r'/api/appdetails': lambda p: {str(p['appids']): respostas.get(str(p['appids']), {'success': False})}}


def _conectar(id_usuario):
    repositorio.gravar_conta(id_usuario, 'steam', Conta(STEAMID, 'Fulano'))


def rawg_que_casa(*jogos):
    """Rotas do RAWG em que cada (appid, slug, nome) casa pela loja da Steam."""
    rotas = {}
    por_nome = {nome: (appid, slug) for appid, slug, nome in jogos}
    rotas[r'/games$'] = lambda p: {'results': [resultado_rawg(por_nome[p['search']][1], p['search'])]
                                   if p['search'] in por_nome else []}
    for appid, slug, nome in jogos:
        rotas[rf'/games/{slug}/stores$'] = {'results': [{'url': f'https://store.steampowered.com/app/{appid}/'}]}
        rotas[rf'/games/{slug}$'] = detalhe_rawg(slug, nome)
    return rotas


def _no_catalogo(appid, slug, nome, casado=True):
    id_midia = processar_e_inserir_jogo(detalhe_rawg(slug, nome), detalhe_rawg(slug, nome))['id_midia']
    if casado:
        banco.executar('INSERT INTO steam_appids (appid, id_midia, nome) VALUES (%s, %s, %s)', (appid, id_midia, nome))
    return id_midia


def _na_lista(id_usuario, id_midia, status, horas):
    banco.executar(
        'INSERT INTO lista_usuarios (id_usuario, id_midia, status_consumo, progresso_atual) VALUES (%s, %s, %s, %s)',
        (id_usuario, id_midia, status, horas),
    )


def _item(id_usuario, slug):
    return banco.consultar_um(
        'SELECT l.status_consumo, l.progresso_atual FROM lista_usuarios l JOIN jogos j USING (id_midia) '
        'WHERE l.id_usuario = %s AND j.rawg_slug = %s',
        (id_usuario, slug),
    )


def _casamento(appid):
    return banco.consultar_um('SELECT id_midia, nome FROM steam_appids WHERE appid = %s', (appid,))


def _da_loja(appid):
    return banco.consultar_um(
        'SELECT m.id_midia, m.titulo_original, m.poster_url, m.nota_fonte, j.rawg_slug, j.steam_appid, j.desenvolvedor '
        'FROM jogos j JOIN midias m USING (id_midia) WHERE j.steam_appid = %s',
        (appid,),
    )


def _item_da_midia(id_usuario, id_midia):
    return banco.consultar_um(
        'SELECT status_consumo, progresso_atual FROM lista_usuarios WHERE id_usuario = %s AND id_midia = %s',
        (id_usuario, id_midia),
    )


def _sincronizar(client, headers):
    resposta = client.post('/api/integracoes/steam/sincronizar', headers=headers)
    assert resposta.status_code == 200, resposta.get_json()
    return resposta.get_json()


# ============================================
# Conectar
# ============================================

def test_conecta_a_steam_pela_url_do_perfil(client, usuario, fontes):
    _, headers = usuario
    fontes([], vanity={'fulano': STEAMID})

    r = client.put('/api/integracoes/steam', json={'identificador': 'https://steamcommunity.com/id/fulano/'},
                   headers=headers)

    assert r.status_code == 200, r.get_json()
    assert r.get_json()['identificador'] == STEAMID
    assert r.get_json()['nome_exibicao'] == 'Fulano'


def test_perfil_privado_responde_perfil_privado(client, usuario, fontes):
    _, headers = usuario
    fontes([], visibilidade=1)

    r = client.put('/api/integracoes/steam', json={'identificador': STEAMID}, headers=headers)

    assert r.status_code == 400
    assert r.get_json()['codigo'] == 'perfil_privado'


def test_sem_chave_a_steam_aparece_indisponivel(client, usuario, monkeypatch):
    _, headers = usuario
    monkeypatch.setitem(servico.PLATAFORMAS, 'steam', Steam(chave=''))

    integracoes = client.get('/api/integracoes', headers=headers).get_json()['integracoes']
    r = client.post('/api/integracoes/steam/sincronizar', headers=headers)

    assert next(i for i in integracoes if i['plataforma'] == 'steam')['disponivel'] is False
    assert r.status_code == 503


def test_steam_nao_tem_previa_e_responde_400_com_mensagem(client, usuario, fontes):
    id_usuario, headers = usuario
    fontes([])
    _conectar(id_usuario)

    r = client.post('/api/integracoes/steam/previa', headers=headers)

    assert r.status_code == 400
    assert r.get_json()['codigo'] == 'requisicao_invalida'
    assert 'Sincronizar agora' in r.get_json()['erro']


def test_jogo_aberto_por_poucos_minutos_entra_com_1_hora(client, usuario, fontes, jogo):
    id_usuario, headers = usuario
    appid, slug, nome = jogo('Rapido')
    _no_catalogo(appid, slug, nome)
    fontes([jogo_steam(appid, nome, 10, HORA)])
    _conectar(id_usuario)

    corpo = _sincronizar(client, headers)

    assert corpo['novos'] == 1
    assert _item(id_usuario, slug) == {'status_consumo': 'pausado', 'progresso_atual': 1}


def test_sincronizar_sem_conta_e_404(client, usuario, fontes):
    _, headers = usuario
    fontes([])

    r = client.post('/api/integracoes/steam/sincronizar', headers=headers)

    assert r.status_code == 404


# ============================================
# Sincronizar agora
# ============================================

def test_jogo_novo_casa_no_rawg_entra_no_catalogo_e_na_lista(client, usuario, fontes, jogo):
    id_usuario, headers = usuario
    recente, antigo = jogo('Recente'), jogo('Antigo')
    import time
    fontes(
        [jogo_steam(recente[0], recente[2], 150, int(time.time())), jogo_steam(antigo[0], antigo[2], 600, HORA)],
        rawg_que_casa(recente, antigo),
    )
    _conectar(id_usuario)

    corpo = _sincronizar(client, headers)

    assert (corpo['novos'], corpo['atualizados'], corpo['pendentes'], corpo['total_nao_encontrados']) == (2, 0, 0, 0)
    assert _item(id_usuario, recente[1]) == {'status_consumo': 'jogando', 'progresso_atual': 3}
    assert _item(id_usuario, antigo[1]) == {'status_consumo': 'pausado', 'progresso_atual': 10}
    assert _casamento(recente[0])['id_midia'] is not None
    conta = repositorio.conta(id_usuario, 'steam')
    assert conta['ultima_sincronizacao'] is not None
    assert conta['ultimo_resultado']['novos'] == 2


def test_sem_casamento_no_rawg_grava_negativo_e_nao_busca_de_novo_ate_30_dias(client, usuario, fontes, jogo):
    id_usuario, headers = usuario
    appid, _, nome = jogo('Obscuro')
    rawg = fontes([jogo_steam(appid, nome, 120, HORA)], {r'/games$': {'results': []}})
    _conectar(id_usuario)

    primeira = _sincronizar(client, headers)
    buscas = len(rawg.chamadas)
    segunda = _sincronizar(client, headers)
    buscas_na_segunda = len(rawg.chamadas) - buscas
    banco.executar("UPDATE steam_appids SET tentado_em = now() - interval '31 days' WHERE appid = %s", (appid,))
    _sincronizar(client, headers)

    assert primeira['nao_encontrados'] == [{
        'titulo': nome, 'link': f'https://store.steampowered.com/app/{appid}', 'origem_id': str(appid), 'tipo': 'jogo',
    }]
    assert segunda['total_nao_encontrados'] == 1
    assert _casamento(appid) == {'id_midia': None, 'nome': nome}
    assert buscas == 1 and buscas_na_segunda == 0
    assert len(rawg.chamadas) == 2  # depois de 30 dias, busca de novo


def test_ja_casado_atualiza_so_as_horas_maiores_e_respeita_zerado(client, usuario, fontes, jogo):
    id_usuario, headers = usuario
    fila, zerado, menos = jogo('Fila'), jogo('Zerado'), jogo('Menos')
    for appid, slug, nome in (fila, zerado, menos):
        _no_catalogo(appid, slug, nome)
    _na_lista(id_usuario, _casamento(fila[0])['id_midia'], 'na_fila', 0)
    _na_lista(id_usuario, _casamento(zerado[0])['id_midia'], 'zerado', 40)
    _na_lista(id_usuario, _casamento(menos[0])['id_midia'], 'jogando', 50)
    rawg = fontes([
        jogo_steam(fila[0], fila[2], 300, HORA),
        jogo_steam(zerado[0], zerado[2], 3000, HORA),
        jogo_steam(menos[0], menos[2], 600, HORA),
    ])
    _conectar(id_usuario)

    corpo = _sincronizar(client, headers)

    assert (corpo['novos'], corpo['atualizados'], corpo['pendentes']) == (0, 2, 0)
    assert _item(id_usuario, fila[1]) == {'status_consumo': 'jogando', 'progresso_atual': 5}
    assert _item(id_usuario, zerado[1]) == {'status_consumo': 'zerado', 'progresso_atual': 50}
    assert _item(id_usuario, menos[1]) == {'status_consumo': 'jogando', 'progresso_atual': 50}
    assert rawg.chamadas == []


def test_orcamento_esgotado_atualiza_os_casados_e_deixa_os_novos_pendentes(client, usuario, fontes, jogo, monkeypatch):
    id_usuario, headers = usuario
    casado, novo1, novo2 = jogo('Casado'), jogo('Novo1'), jogo('Novo2')
    _no_catalogo(*casado)
    rawg = fontes(
        [jogo_steam(a, n, 120, HORA) for a, _, n in (casado, novo1, novo2)],
        rawg_que_casa(novo1, novo2),
    )
    _conectar(id_usuario)
    monkeypatch.setattr(sincronizacao_steam, 'ORCAMENTO_SEGUNDOS', 0)

    corpo = _sincronizar(client, headers)

    assert (corpo['novos'], corpo['pendentes']) == (1, 2)
    assert _item(id_usuario, casado[1])['progresso_atual'] == 2
    assert rawg.chamadas == []
    assert _casamento(novo1[0]) is None  # pendente não vira negativo


def test_orcamento_e_conferido_antes_de_cada_chamada_ao_rawg(usuario, fontes, jogo):
    """Cada jogo novo pede busca, lojas e detalhe: o orçamento para no meio do segundo jogo."""
    id_usuario, _ = usuario
    jogos = [jogo(f'J{i}') for i in range(3)]
    rawg = fontes([jogo_steam(a, n, 120, HORA) for a, _, n in jogos], rawg_que_casa(*jogos))
    _conectar(id_usuario)
    tempo = iter(range(0, 1000, 10))  # cada leitura do relógio avança 10 s; o início é 0

    corpo = sincronizacao_steam.sincronizar(id_usuario, orcamento=45, relogio=lambda: next(tempo))

    # J0: busca (10), lojas (20), detalhe (30); J1: busca (40), lojas (50 ≥ 45: não sai).
    assert (corpo['novos'], corpo['pendentes']) == (1, 2)
    assert len(rawg.chamadas) == 4
    assert _casamento(jogos[1][0]) is None  # pendente no meio do casamento não grava nada


def test_rawg_fora_do_ar_deixa_pendentes_sem_gravar_negativo(client, usuario, fontes, jogo):
    id_usuario, headers = usuario
    a, b = jogo('A'), jogo('B')
    fontes([jogo_steam(x[0], x[2], 120, HORA) for x in (a, b)], {r'/games$': Resposta(502, {})})
    _conectar(id_usuario)

    corpo = _sincronizar(client, headers)

    assert corpo['pendentes'] == 2 and corpo['novos'] == 0
    assert _casamento(a[0]) is None and _casamento(b[0]) is None


def test_jogo_do_rawg_ja_no_catalogo_casa_sem_importar_de_novo(client, usuario, fontes, jogo):
    id_usuario, headers = usuario
    appid, slug, nome = jogo('JaTem')
    id_midia = _no_catalogo(appid, slug, nome, casado=False)
    rotas = rawg_que_casa((appid, slug, nome))
    rotas.pop(rf'/games/{slug}$')  # o detalhe não é pedido
    fontes([jogo_steam(appid, nome, 120, HORA)], rotas)
    _conectar(id_usuario)

    corpo = _sincronizar(client, headers)

    assert corpo['novos'] == 1
    assert _casamento(appid)['id_midia'] == id_midia


def test_perfil_que_ficou_privado_responde_perfil_privado_ao_sincronizar(client, usuario, fontes):
    id_usuario, headers = usuario
    fontes(None, privado_jogos=True)
    _conectar(id_usuario)

    r = client.post('/api/integracoes/steam/sincronizar', headers=headers)

    assert r.status_code == 400 and r.get_json()['codigo'] == 'perfil_privado'


# ============================================
# Job diário
# ============================================

def test_job_sincroniza_todos_sem_orcamento_e_nao_vaza_as_chaves(pg, fontes, jogo, monkeypatch, tmp_path, capsys):  # noqa: F811
    monkeypatch.setattr(utils, 'LOG_PATH', tmp_path / 'importacao.log')
    monkeypatch.setattr(utils, 'ERROR_LOG_PATH', tmp_path / 'erros.jsonl')
    monkeypatch.setattr('config.STEAM_API_KEY', CHAVE_STEAM)
    monkeypatch.setattr('importacao.config.RAWG_API_KEY', CHAVE_RAWG)
    monkeypatch.setattr(sincronizacao_steam, 'ORCAMENTO_SEGUNDOS', 0)  # o job não usa
    um, dois = _usuario(pg), _usuario(pg)
    jogos = [jogo(f'Job{i}') for i in range(2)]
    fontes([jogo_steam(a, n, 120, HORA) for a, _, n in jogos], rawg_que_casa(*jogos))
    _conectar(um)
    _conectar(dois)
    monkeypatch.setattr(job_steam, 'usuarios_com_steam', lambda: [um, dois])
    monkeypatch.setattr(sys, 'argv', ['job_steam'])

    try:
        codigo = job_steam.main()
    finally:
        utils.remover_log()

    assert codigo == 0
    for id_usuario in (um, dois):
        assert all(_item(id_usuario, slug) for _, slug, _ in jogos)
    log = (tmp_path / 'importacao.log').read_text(encoding='utf-8')
    assert 'Steam' in log
    saida = capsys.readouterr()
    for chave in (CHAVE_STEAM, CHAVE_RAWG):
        assert chave not in log and chave not in saida.out and chave not in saida.err


def test_job_falha_de_um_usuario_nao_para_os_outros_e_sai_com_erro(pg, monkeypatch, tmp_path, capsys):  # noqa: F811
    monkeypatch.setattr(utils, 'LOG_PATH', tmp_path / 'importacao.log')
    monkeypatch.setattr(utils, 'ERROR_LOG_PATH', tmp_path / 'erros.jsonl')
    monkeypatch.setattr('config.STEAM_API_KEY', CHAVE_STEAM)
    erro = ConnectionError(f'falhou /IPlayerService/GetOwnedGames/v1/?key={CHAVE_STEAM}&steamid=1')
    monkeypatch.setitem(servico.PLATAFORMAS, 'steam', Steam(sessao=SessaoGet({r'.': erro}), chave=CHAVE_STEAM))
    um, dois = _usuario(pg), _usuario(pg)
    _conectar(um)
    _conectar(dois)
    vistos = []
    original = sincronizacao_steam.sincronizar
    monkeypatch.setattr(job_steam, 'usuarios_com_steam', lambda: [um, dois])
    monkeypatch.setattr(sincronizacao_steam, 'sincronizar',
                        lambda id_usuario, **kw: vistos.append(id_usuario) or original(id_usuario, **kw))

    try:
        codigo = job_steam.main()
    finally:
        utils.remover_log()

    assert codigo == 1
    assert vistos == [um, dois]
    jsonl = (tmp_path / 'erros.jsonl').read_text(encoding='utf-8')
    log = (tmp_path / 'importacao.log').read_text(encoding='utf-8')
    assert jsonl.strip()
    assert CHAVE_STEAM not in jsonl and CHAVE_STEAM not in log and CHAVE_STEAM not in capsys.readouterr().err


def test_job_sem_chave_da_steam_pula_sem_erro(monkeypatch, tmp_path):
    monkeypatch.setattr(utils, 'LOG_PATH', tmp_path / 'importacao.log')
    monkeypatch.setitem(servico.PLATAFORMAS, 'steam', Steam(chave=''))
    monkeypatch.setattr(job_steam, 'usuarios_com_steam', lambda: pytest.fail('não deveria ler o banco'))

    try:
        assert job_steam.main() == 0
    finally:
        utils.remover_log()



# ============================================
# Fallback pela loja da Steam (spec nao-encontrados)
# ============================================

def test_jogo_fora_do_rawg_entra_pela_loja_da_steam_e_depois_so_atualiza(client, usuario, fontes, jogo):
    id_usuario, headers = usuario
    appid, _, nome = jogo('SoNaSteam')
    rawg = fontes([jogo_steam(appid, nome, 120, HORA)], {r'/games$': {'results': []}},
                  loja=loja_com(appdetails(appid, nome, desenvolvedoras=['Estúdio'])))
    _conectar(id_usuario)

    corpo = _sincronizar(client, headers)

    assert (corpo['novos'], corpo['total_nao_encontrados'], corpo['pendentes']) == (1, 0, 0)
    midia = _da_loja(appid)
    assert midia['titulo_original'] == nome and midia['desenvolvedor'] == 'Estúdio'
    assert midia['poster_url'].endswith(f'/apps/{appid}/header.jpg')
    assert (midia['rawg_slug'], midia['nota_fonte']) == (None, None)
    assert _casamento(appid)['id_midia'] == midia['id_midia']
    assert _item_da_midia(id_usuario, midia['id_midia']) == {'status_consumo': 'pausado', 'progresso_atual': 2}

    chamadas = (len(rawg.chamadas), len(rawg.loja.chamadas))
    fontes([jogo_steam(appid, nome, 600, HORA)], {}, loja={})
    segunda = _sincronizar(client, headers)

    assert chamadas == (1, 1)
    assert (segunda['novos'], segunda['atualizados']) == (0, 1)
    assert _item_da_midia(id_usuario, midia['id_midia'])['progresso_atual'] == 10


def test_outro_usuario_com_o_mesmo_jogo_da_loja_casa_sem_chamar_nada(client, usuario, fontes, jogo, pg, make_token):  # noqa: F811
    id_usuario, headers = usuario
    appid, _, nome = jogo('Compartilhado')
    fontes([jogo_steam(appid, nome, 120, HORA)], {r'/games$': {'results': []}}, loja=loja_com(appdetails(appid, nome)))
    _conectar(id_usuario)
    _sincronizar(client, headers)
    outro = _usuario(pg)
    _conectar(outro)
    rawg = fontes([jogo_steam(appid, nome, 60, HORA)], {}, loja={})

    corpo = _sincronizar(client, {'Authorization': f'Bearer {make_token(outro)}'})

    assert corpo['novos'] == 1
    assert rawg.chamadas == [] and rawg.loja.chamadas == []
    assert banco.consultar_um('SELECT count(*) AS n FROM jogos WHERE steam_appid = %s', (appid,))['n'] == 1


@pytest.mark.parametrize('tipo', ['application', 'dlc', 'music'])
def test_software_dlc_e_trilha_somem_dos_nao_encontrados_e_nao_sao_buscados_de_novo(
    client, usuario, fontes, jogo, tipo,
):
    id_usuario, headers = usuario
    appid, _, nome = jogo('NaoJogo')
    rawg = fontes([jogo_steam(appid, nome, 120, HORA)], {r'/games$': {'results': []}},
                  loja=loja_com(appdetails(appid, nome, tipo=tipo)))
    _conectar(id_usuario)

    primeira = _sincronizar(client, headers)
    banco.executar("UPDATE steam_appids SET tentado_em = now() - interval '31 days' WHERE appid = %s", (appid,))
    chamadas = (len(rawg.chamadas), len(rawg.loja.chamadas))
    segunda = _sincronizar(client, headers)

    for corpo in (primeira, segunda):
        assert (corpo['novos'], corpo['atualizados'], corpo['pendentes']) == (0, 0, 0)
        assert (corpo['nao_encontrados'], corpo['total_nao_encontrados']) == ([], 0)
    assert banco.consultar_um('SELECT id_midia, ignorado FROM steam_appids WHERE appid = %s', (appid,)) == {
        'id_midia': None, 'ignorado': True,
    }
    assert _da_loja(appid) is None
    assert (len(rawg.chamadas), len(rawg.loja.chamadas)) == chamadas == (1, 1)
    assert repositorio.conta(id_usuario, 'steam')['ultimo_resultado']['total_nao_encontrados'] == 0


def test_loja_sem_a_appid_fica_nao_encontrado_ate_30_dias(client, usuario, fontes, jogo):
    id_usuario, headers = usuario
    appid, _, nome = jogo('Retirado')
    rawg = fontes([jogo_steam(appid, nome, 120, HORA)], {r'/games$': {'results': []}})
    _conectar(id_usuario)

    primeira = _sincronizar(client, headers)
    segunda = _sincronizar(client, headers)

    assert primeira['total_nao_encontrados'] == segunda['total_nao_encontrados'] == 1
    assert _casamento(appid) == {'id_midia': None, 'nome': nome}
    assert len(rawg.loja.chamadas) == 1


@pytest.mark.parametrize('falha', [Resposta(429, {}), Resposta(503, {}), ConnectionError('caiu')])
def test_loja_fora_do_ar_deixa_pendente_sem_gravar_negativo(client, usuario, fontes, jogo, falha):
    id_usuario, headers = usuario
    a, b = jogo('A'), jogo('B')
    fontes([jogo_steam(x[0], x[2], 120, HORA) for x in (a, b)], {r'/games$': {'results': []}},
           loja={r'appdetails': falha})
    _conectar(id_usuario)

    corpo = _sincronizar(client, headers)

    assert (corpo['pendentes'], corpo['novos'], corpo['total_nao_encontrados']) == (2, 0, 0)
    assert _casamento(a[0]) is None and _casamento(b[0]) is None


def test_orcamento_tambem_e_conferido_antes_da_loja(usuario, fontes, jogo):
    id_usuario, _ = usuario
    appid, _, nome = jogo('Lento')
    rawg = fontes([jogo_steam(appid, nome, 120, HORA)], {r'/games$': {'results': []}},
                  loja=loja_com(appdetails(appid, nome)))
    _conectar(id_usuario)
    tempo = iter(range(0, 1000, 10))  # cada leitura do relógio avança 10 s; o início é 0

    # Busca no RAWG em 10 (< 15); a loja em 20 (≥ 15) não sai.
    corpo = sincronizacao_steam.sincronizar(id_usuario, orcamento=15, relogio=lambda: next(tempo))

    assert (corpo['pendentes'], corpo['novos'], corpo['total_nao_encontrados']) == (1, 0, 0)
    assert len(rawg.chamadas) == 1 and rawg.loja.chamadas == []
    assert _casamento(appid) is None


def test_jogo_que_ja_tem_a_appid_no_catalogo_casa_sem_rawg_nem_loja(client, usuario, fontes, jogo):
    """A Importação do RAWG gravou a appid (lojas): a Steam casa direto pelo Catálogo."""
    id_usuario, headers = usuario
    appid, slug, nome = jogo('ComAppid')
    detalhe = {**detalhe_rawg(slug, nome), 'stores': [{'url': f'https://store.steampowered.com/app/{appid}/'}]}
    id_midia = processar_e_inserir_jogo(detalhe, detalhe)['id_midia']
    rawg = fontes([jogo_steam(appid, nome, 120, HORA)], {}, loja={})
    _conectar(id_usuario)

    corpo = _sincronizar(client, headers)

    assert corpo['novos'] == 1
    assert rawg.chamadas == [] and rawg.loja.chamadas == []
    assert _casamento(appid)['id_midia'] == id_midia


def test_importacao_do_rawg_com_a_appid_atualiza_o_jogo_da_loja_em_vez_de_criar_outro(
    client, usuario, fontes, jogo,
):
    id_usuario, headers = usuario
    appid, slug, nome = jogo('DepoisNoRawg')
    fontes([jogo_steam(appid, nome, 120, HORA)], {r'/games$': {'results': []}}, loja=loja_com(appdetails(appid, nome)))
    _conectar(id_usuario)
    _sincronizar(client, headers)
    da_loja = _da_loja(appid)['id_midia']

    basico = {**detalhe_rawg(slug, f'{nome} (RAWG)'), 'rating': 4.5}
    detalhe = {**basico, 'stores': [{'id': 1, 'url': f'https://store.steampowered.com/app/{appid}/x/'}]}
    do_rawg = processar_e_inserir_jogo(basico, detalhe)

    assert do_rawg == {'id_midia': da_loja, 'ja_existia': True}
    midia = _da_loja(appid)
    assert (midia['rawg_slug'], midia['titulo_original']) == (slug, f'{nome} (RAWG)')
    assert midia['nota_fonte'] is not None
    assert banco.consultar_um('SELECT count(*) AS n FROM jogos WHERE rawg_slug = %s', (slug,))['n'] == 1
    # A Lista continua no mesmo Item, e a próxima sincronização segue casando.
    fontes([jogo_steam(appid, nome, 600, HORA)], {}, loja={})
    assert _sincronizar(client, headers)['atualizados'] == 1


def test_casamento_novo_pelo_rawg_grava_a_appid_na_midia(client, usuario, fontes, jogo):
    """O RAWG casou pelas lojas: a Mídia importada guarda a appid (a loja não cria outra depois)."""
    id_usuario, headers = usuario
    j = jogo('PeloRawg')
    fontes([jogo_steam(j[0], j[2], 120, HORA)], rawg_que_casa(j))
    _conectar(id_usuario)

    _sincronizar(client, headers)

    assert _da_loja(j[0])['rawg_slug'] == j[1]
