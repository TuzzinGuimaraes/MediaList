"""Integrações pelas rotas, com o PostgreSQL real e o AniList falso (sessão HTTP em memória).

Conectar, prévia (1 h, só do dono), confirmar (Catálogo sob demanda, Não encontrados, regras
da Q110) e desconectar. Usa TEST_DATABASE_URL; sem ela, pula. Cada teste apaga o que gravou.
"""
import random
import uuid

import pytest

import banco
from importacao import db as importacao
from integracoes import servico
from integracoes.anilist import AniList
from integracoes.plataforma import Conta, ItemDeOrigem, PerfilPrivado, RefCatalogo

from .test_integracoes_anilist import SessaoFalsa, _colecao, _entrada, _erro, _media
from .test_repositorios_pg import TEST_DATABASE_URL, _usuario, pg  # noqa: F401 (fixture)

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para as Integrações'
)


def _id_anilist():
    return random.randint(10**8, 2 * 10**9)


@pytest.fixture
def anilist_ids(pg):  # noqa: F811
    """anilist_ids usados no teste: as Mídias com eles são apagadas no fim (inclusive as importadas)."""
    ids = []
    yield ids
    if ids:
        banco.executar(
            'DELETE FROM midias WHERE id_midia IN (SELECT id_midia FROM animes WHERE anilist_id = ANY(%s) '
            'UNION SELECT id_midia FROM mangas WHERE anilist_id = ANY(%s))',
            (ids, ids),
        )


@pytest.fixture
def usuario(pg, make_token):  # noqa: F811
    id_usuario = _usuario(pg)
    return id_usuario, {'Authorization': f'Bearer {make_token(id_usuario)}'}


@pytest.fixture
def anilist(monkeypatch):
    """Troca a sessão do AniList registrado; `anilist(*respostas)` enfileira as respostas."""
    def instalar(*respostas):
        sessao = SessaoFalsa(*respostas)
        monkeypatch.setitem(servico.PLATAFORMAS, 'anilist', AniList(sessao=sessao))
        return sessao

    return instalar


def _anime_no_catalogo(anilist_ids, episodios=12):
    id_anilist = _id_anilist()
    anilist_ids.append(id_anilist)
    dados = {
        'titulo_original': f'INT {uuid.uuid4().hex}', 'anilist_id': id_anilist,
        'status_anime': 'finalizado', 'numero_episodios': episodios,
    }
    return id_anilist, importacao.salvar_anime(dados, [])['id_midia']


def _media_nova(anilist_ids, titulo='Nova', episodios=24):
    id_anilist = _id_anilist()
    anilist_ids.append(id_anilist)
    return _media(id_anilist, titulo, episodes=episodios, status='FINISHED', genres=['Action'])


def _item(id_usuario, id_midia):
    return banco.consultar_um(
        'SELECT status_consumo, progresso_atual, nota_usuario, comentario, favorito, total_rewatches '
        'FROM lista_usuarios WHERE id_usuario = %s AND id_midia = %s',
        (id_usuario, id_midia),
    )


def _conectar(client, headers, anilist, nome='fulano'):
    anilist(_colecao(nome=nome))
    resposta = client.put('/api/integracoes/anilist', json={'identificador': nome}, headers=headers)
    assert resposta.status_code == 200, resposta.get_json()
    return resposta


# ============================================
# Conectar e desconectar
# ============================================

def test_lista_as_plataformas_e_conecta_o_anilist(client, usuario, anilist):
    id_usuario, headers = usuario

    antes = client.get('/api/integracoes', headers=headers).get_json()['integracoes']
    conectada = _conectar(client, headers, anilist, 'Fulano').get_json()
    depois = client.get('/api/integracoes', headers=headers).get_json()['integracoes']

    assert antes[0]['plataforma'] == 'anilist'  # a primeira; as outras nos testes delas
    assert antes[0]['conectada'] is False and antes[0]['disponivel'] is True
    assert conectada['conectada'] is True
    assert conectada['nome_exibicao'] == 'Fulano'
    assert depois[0]['identificador'] == 'Fulano'
    assert depois[0]['ultima_sincronizacao'] is None


@pytest.mark.parametrize(('resposta', 'status', 'codigo'), [
    (_erro(404, 'Private User'), 400, 'perfil_privado'),
    (_erro(404, 'User not found'), 404, 'perfil_nao_encontrado'),
    (_erro(500, 'Internal'), 502, 'origem_indisponivel'),
])
def test_perfil_que_nao_da_para_ler_responde_erro_distinguivel(client, usuario, anilist, resposta, status, codigo):
    id_usuario, headers = usuario
    anilist(resposta)

    r = client.put('/api/integracoes/anilist', json={'identificador': 'fulano'}, headers=headers)

    assert r.status_code == status
    assert r.get_json()['codigo'] == codigo
    assert r.get_json()['erro']
    assert banco.consultar_um('SELECT 1 AS x FROM integracoes WHERE id_usuario = %s', (id_usuario,)) is None


def test_plataforma_desconhecida_responde_404(client, usuario):
    _, headers = usuario

    r = client.put('/api/integracoes/orkut', json={'identificador': 'x'}, headers=headers)

    assert r.status_code == 404
    assert r.get_json()['codigo'] == 'nao_encontrado'


def test_desconectar_apaga_a_conta_e_as_previas(client, usuario, anilist):
    id_usuario, headers = usuario
    _conectar(client, headers, anilist)
    anilist(_colecao(), _colecao())
    client.post('/api/integracoes/anilist/previa', headers=headers)

    r = client.delete('/api/integracoes/anilist', headers=headers)

    assert r.status_code == 200
    assert client.get('/api/integracoes', headers=headers).get_json()['integracoes'][0]['conectada'] is False
    assert banco.consultar_um(
        'SELECT count(*) AS n FROM importacao_previas WHERE id_usuario = %s', (id_usuario,)
    )['n'] == 0


# ============================================
# Prévia e confirmação
# ============================================

def test_previa_conta_sem_gravar_e_confirmar_aplica_as_regras(client, usuario, anilist, anilist_ids):
    id_usuario, headers = usuario
    id_existente, midia_existente = _anime_no_catalogo(anilist_ids)
    id_no_catalogo, midia_no_catalogo = _anime_no_catalogo(anilist_ids)
    nova = _media_nova(anilist_ids, 'Obra nova')
    banco.executar(
        "INSERT INTO lista_usuarios (id_usuario, id_midia, status_consumo, progresso_atual, nota_usuario, "
        "comentario, favorito) VALUES (%s, %s, 'pausado', 3, 7.0, 'meu comentário', true)",
        (id_usuario, midia_existente),
    )
    _conectar(client, headers, anilist)
    respostas = (
        _colecao((False, [
            _entrada(_media(id_existente), progress=7, score=9.5),
            _entrada(_media(id_no_catalogo), status='PLANNING', progress=0, score=0),
            _entrada(nova, status='COMPLETED', progress=24, completedAt={'year': 2025, 'month': 1, 'day': 2}),
        ])),
        _colecao(),
    )
    anilist(*respostas)

    previa = client.post('/api/integracoes/anilist/previa', headers=headers)

    corpo = previa.get_json()
    assert previa.status_code == 200, corpo
    assert (corpo['novos'], corpo['atualizados'], corpo['total_nao_encontrados']) == (2, 1, 0)
    assert corpo['expira_em']
    assert _item(id_usuario, midia_no_catalogo) is None
    assert banco.consultar_um('SELECT 1 AS x FROM animes WHERE anilist_id = %s', (nova['id'],)) is None

    confirmado = client.post(f"/api/integracoes/previas/{corpo['id_previa']}/confirmar", headers=headers)

    assert confirmado.status_code == 200, confirmado.get_json()
    assert confirmado.get_json() == {'novos': 2, 'atualizados': 1, 'nao_encontrados': [], 'total_nao_encontrados': 0}
    existente = _item(id_usuario, midia_existente)
    assert (existente['status_consumo'], existente['progresso_atual']) == ('assistindo', 7)
    assert (float(existente['nota_usuario']), existente['comentario'], existente['favorito']) == (
        7.0, 'meu comentário', True,
    )
    assert _item(id_usuario, midia_no_catalogo)['status_consumo'] == 'planejado'
    importada = banco.consultar_um(
        'SELECT a.id_midia, a.numero_episodios FROM animes a WHERE a.anilist_id = %s', (nova['id'],)
    )
    assert importada['numero_episodios'] == 24
    novo_item = _item(id_usuario, importada['id_midia'])
    assert (novo_item['status_consumo'], novo_item['progresso_atual'], novo_item['total_rewatches']) == (
        'completo', 24, 0,
    )
    conta = client.get('/api/integracoes', headers=headers).get_json()['integracoes'][0]
    assert conta['ultima_sincronizacao']
    assert conta['ultimo_resultado']['novos'] == 2


def test_previa_so_vale_uma_vez_e_so_para_o_dono(client, usuario, anilist, pg, make_token):  # noqa: F811
    _, headers = usuario
    outro = {'Authorization': f'Bearer {make_token(_usuario(pg))}'}
    _conectar(client, headers, anilist)
    anilist(_colecao(), _colecao())
    id_previa = client.post('/api/integracoes/anilist/previa', headers=headers).get_json()['id_previa']

    de_outro = client.post(f'/api/integracoes/previas/{id_previa}/confirmar', headers=outro)
    primeira = client.post(f'/api/integracoes/previas/{id_previa}/confirmar', headers=headers)
    segunda = client.post(f'/api/integracoes/previas/{id_previa}/confirmar', headers=headers)
    malformada = client.post('/api/integracoes/previas/nao-e-uuid/confirmar', headers=headers)

    assert de_outro.status_code == 404
    assert primeira.status_code == 200
    assert segunda.status_code == 404
    assert malformada.status_code == 404


def test_previa_expirada_nao_confirma(client, usuario, anilist):
    _, headers = usuario
    _conectar(client, headers, anilist)
    anilist(_colecao(), _colecao())
    id_previa = client.post('/api/integracoes/anilist/previa', headers=headers).get_json()['id_previa']
    banco.executar(
        "UPDATE importacao_previas SET expira_em = now() - interval '1 second' WHERE id_previa = %s", (id_previa,)
    )

    assert client.post(f'/api/integracoes/previas/{id_previa}/confirmar', headers=headers).status_code == 404


def test_previa_sem_conectar_responde_404(client, usuario):
    _, headers = usuario

    r = client.post('/api/integracoes/anilist/previa', headers=headers)

    assert r.status_code == 404
    assert 'Conecte' in r.get_json()['erro']


def test_perfil_que_ficou_privado_na_previa(client, usuario, anilist):
    _, headers = usuario
    _conectar(client, headers, anilist)
    anilist(_erro(404, 'Private User'))

    r = client.post('/api/integracoes/anilist/previa', headers=headers)

    assert (r.status_code, r.get_json()['codigo']) == (400, 'perfil_privado')


class _PlataformaFalsa:
    """Plataforma com itens fixos, para o que o AniList não produz (item sem casamento)."""

    nome = 'anilist'
    rotulo = 'AniList'

    def __init__(self, itens, erro=None):
        self.itens = itens
        self.erro = erro

    def disponivel(self):
        return True

    def conectar(self, identificador):
        return Conta(identificador, identificador)

    def ler(self, conta):
        if self.erro:
            raise self.erro
        return self.itens


def test_item_sem_casamento_vai_para_nao_encontrados_com_titulo_e_link(client, usuario, monkeypatch):
    _, headers = usuario
    sem_casar = ItemDeOrigem('9', 'anime', 'Obra rara', 'https://anilist.co/anime/9', status='concluido')
    monkeypatch.setitem(servico.PLATAFORMAS, 'anilist', _PlataformaFalsa([sem_casar]))
    client.put('/api/integracoes/anilist', json={'identificador': 'fulano'}, headers=headers)

    corpo = client.post('/api/integracoes/anilist/previa', headers=headers).get_json()
    confirmado = client.post(f"/api/integracoes/previas/{corpo['id_previa']}/confirmar", headers=headers).get_json()

    esperado = [{'titulo': 'Obra rara', 'link': 'https://anilist.co/anime/9', 'origem_id': '9', 'tipo': 'anime'}]
    assert (corpo['novos'], corpo['nao_encontrados'], corpo['total_nao_encontrados']) == (0, esperado, 1)
    assert confirmado['nao_encontrados'] == esperado


def test_obra_que_falha_ao_importar_vira_nao_encontrada(client, usuario, monkeypatch, anilist_ids):
    _, headers = usuario
    quebrada = _media_nova(anilist_ids, 'Quebrada')
    quebrada['title'] = None  # processar_e_inserir_anime não tem título para gravar
    item = ItemDeOrigem(
        str(quebrada['id']), 'anime', 'Quebrada', 'https://anilist.co/anime/x', status='concluido',
        catalogo=RefCatalogo('anilist', str(quebrada['id']), quebrada),
    )
    monkeypatch.setitem(servico.PLATAFORMAS, 'anilist', _PlataformaFalsa([item]))
    client.put('/api/integracoes/anilist', json={'identificador': 'fulano'}, headers=headers)

    corpo = client.post('/api/integracoes/anilist/previa', headers=headers).get_json()
    confirmado = client.post(f"/api/integracoes/previas/{corpo['id_previa']}/confirmar", headers=headers).get_json()

    assert corpo['novos'] == 1
    assert (confirmado['novos'], confirmado['total_nao_encontrados']) == (0, 1)


def test_privado_vindo_da_plataforma_qualquer(client, usuario, monkeypatch):
    _, headers = usuario
    monkeypatch.setitem(servico.PLATAFORMAS, 'anilist', _PlataformaFalsa([], PerfilPrivado('privado, deixe público')))
    client.put('/api/integracoes/anilist', json={'identificador': 'fulano'}, headers=headers)

    r = client.post('/api/integracoes/anilist/previa', headers=headers)

    assert r.get_json() == {'erro': 'privado, deixe público', 'codigo': 'perfil_privado'}



# ============================================
# Confirmar atômico, erros e limites (revisão do ticket 37)
# ============================================

def _previa_com(client, headers, monkeypatch, itens):
    monkeypatch.setitem(servico.PLATAFORMAS, 'anilist', _PlataformaFalsa(itens))
    client.put('/api/integracoes/anilist', json={'identificador': 'fulano'}, headers=headers)
    corpo = client.post('/api/integracoes/anilist/previa', headers=headers).get_json()
    assert 'id_previa' in corpo, corpo
    return corpo


def _item_anilist(id_anilist, **campos):
    return ItemDeOrigem(
        str(id_anilist), 'anime', f'AL {id_anilist}', f'https://anilist.co/anime/{id_anilist}',
        catalogo=RefCatalogo('anilist', str(id_anilist)), **campos,
    )


def _previas(id_usuario):
    return banco.consultar_um('SELECT count(*) AS n FROM importacao_previas WHERE id_usuario = %s', (id_usuario,))['n']


def test_falha_no_meio_do_confirmar_nao_grava_item_nem_consome_a_previa(client, usuario, monkeypatch, anilist_ids):
    from repositories.itens_lista import ItensLista

    id_usuario, headers = usuario
    (id_a, midia_a), (id_b, midia_b) = _anime_no_catalogo(anilist_ids), _anime_no_catalogo(anilist_ids)
    corpo = _previa_com(client, headers, monkeypatch, [
        _item_anilist(id_a, status='em_progresso', progresso=3),
        _item_anilist(id_b, status='em_progresso', progresso=4),
    ])
    original, chamadas = ItensLista.criar_item, []

    def quebra_no_segundo(self, *args):
        chamadas.append(args)
        if len(chamadas) == 2:
            raise RuntimeError('o banco caiu no meio')
        return original(self, *args)

    monkeypatch.setattr(ItensLista, 'criar_item', quebra_no_segundo)
    with pytest.raises(RuntimeError):
        servico.confirmar(id_usuario, corpo['id_previa'])

    assert len(chamadas) == 2
    assert _item(id_usuario, midia_a) is None and _item(id_usuario, midia_b) is None
    assert _previas(id_usuario) == 1
    assert repositorio_conta(id_usuario)['ultimo_resultado'] is None

    monkeypatch.setattr(ItensLista, 'criar_item', original)
    confirmado = client.post(f"/api/integracoes/previas/{corpo['id_previa']}/confirmar", headers=headers)

    assert confirmado.status_code == 200 and confirmado.get_json()['novos'] == 2
    assert _item(id_usuario, midia_a)['progresso_atual'] == 3
    assert _previas(id_usuario) == 0


def repositorio_conta(id_usuario):
    from integracoes import repositorio

    return repositorio.conta(id_usuario, 'anilist')


def test_dois_confirmar_simultaneos_aplicam_uma_vez(client, usuario, monkeypatch, anilist_ids):
    import threading
    import time

    from integracoes import repositorio

    id_usuario, headers = usuario
    id_a, midia_a = _anime_no_catalogo(anilist_ids)
    corpo = _previa_com(client, headers, monkeypatch, [_item_anilist(id_a, status='em_progresso', progresso=3)])
    original = repositorio.registrar_resultado
    dentro = threading.Event()

    def devagar(*args):
        dentro.set()
        time.sleep(0.5)  # segura a transação com a prévia travada
        return original(*args)

    monkeypatch.setattr(repositorio, 'registrar_resultado', devagar)
    resultados = []
    primeiro = threading.Thread(target=lambda: resultados.append(servico.confirmar(id_usuario, corpo['id_previa'])))
    primeiro.start()
    assert dentro.wait(5)
    resultados.append(servico.confirmar(id_usuario, corpo['id_previa']))
    primeiro.join(5)

    assert sorted(r is None for r in resultados) == [False, True]
    assert next(r for r in resultados if r)['novos'] == 1
    assert _item(id_usuario, midia_a)['progresso_atual'] == 3


def test_importacao_nao_mexe_na_recontagem_quando_a_origem_chega_ao_total(client, usuario, monkeypatch, anilist_ids):
    """Q114b: Item que já tinha conclusão e a origem chega ao total: Concluído, Recontagem igual."""
    id_usuario, headers = usuario
    id_a, midia_a = _anime_no_catalogo(anilist_ids, episodios=12)
    banco.executar(
        "INSERT INTO lista_usuarios (id_usuario, id_midia, status_consumo, progresso_atual, data_conclusao, "
        "total_rewatches) VALUES (%s, %s, 'assistindo', 5, '2020-01-01', 2)",
        (id_usuario, midia_a),
    )
    corpo = _previa_com(client, headers, monkeypatch, [_item_anilist(id_a, status='concluido', progresso=12)])

    client.post(f"/api/integracoes/previas/{corpo['id_previa']}/confirmar", headers=headers)

    item = _item(id_usuario, midia_a)
    assert (item['status_consumo'], item['progresso_atual'], item['total_rewatches']) == ('completo', 12, 2)


def test_lista_grande_demais_responde_413_com_mensagem(client, usuario, monkeypatch):
    from integracoes.plataforma import ListaGrandeDemais

    _, headers = usuario
    monkeypatch.setitem(servico.PLATAFORMAS, 'anilist', _PlataformaFalsa([], ListaGrandeDemais()))
    client.put('/api/integracoes/anilist', json={'identificador': 'fulano'}, headers=headers)

    r = client.post('/api/integracoes/anilist/previa', headers=headers)

    assert r.status_code == 413
    assert r.get_json()['codigo'] == 'lista_grande_demais'
    assert '5000' in r.get_json()['erro']


def test_subclasse_de_erro_da_integracao_usa_o_codigo_da_base(client, usuario, monkeypatch):
    class PrivadoEspecial(PerfilPrivado):
        pass

    _, headers = usuario
    monkeypatch.setitem(servico.PLATAFORMAS, 'anilist', _PlataformaFalsa([], PrivadoEspecial('privado')))
    client.put('/api/integracoes/anilist', json={'identificador': 'fulano'}, headers=headers)

    r = client.post('/api/integracoes/anilist/previa', headers=headers)

    assert (r.status_code, r.get_json()['codigo']) == (400, 'perfil_privado')


def test_prazo_da_requisicao_vencido_responde_502_com_mensagem(client, usuario, anilist, monkeypatch):
    from integracoes import prazo

    _, headers = usuario
    _conectar(client, headers, anilist)
    sessao = anilist(_colecao(), _colecao())
    monkeypatch.setattr(prazo, 'PRAZO_SEGUNDOS', 0)

    r = client.post('/api/integracoes/anilist/previa', headers=headers)

    assert (r.status_code, r.get_json()['codigo']) == (502, 'origem_indisponivel')
    assert 'demorou' in r.get_json()['erro']
    assert sessao.enviados == []


def test_link_fora_das_plataformas_sai_sem_link_nos_nao_encontrados(client, usuario, monkeypatch):
    _, headers = usuario
    corpo = _previa_com(client, headers, monkeypatch, [
        ItemDeOrigem('9', 'anime', 'Obra', 'javascript:alert(1)', status='concluido'),
    ])

    assert corpo['nao_encontrados'] == [{'titulo': 'Obra', 'link': None, 'origem_id': '9', 'tipo': 'anime'}]
