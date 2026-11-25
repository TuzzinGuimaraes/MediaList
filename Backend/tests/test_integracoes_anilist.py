"""Plataforma AniList: `MediaListCollection` com sessão HTTP falsa (nada de rede)."""
import pytest

from integracoes.anilist import AniList
from integracoes.plataforma import Conta, OrigemIndisponivel, PerfilNaoEncontrado, PerfilPrivado
from schemas.estado_consumo import CONCLUIDO, EM_PROGRESSO


class _Resposta:
    def __init__(self, status_code, corpo):
        self.status_code = status_code
        self._corpo = corpo

    def json(self):
        return self._corpo


class SessaoFalsa:
    """Responde cada POST com a próxima resposta da fila; guarda o corpo enviado."""

    def __init__(self, *respostas):
        self.respostas = list(respostas)
        self.enviados = []
        self.timeouts = []

    def post(self, url, json=None, timeout=None):
        self.enviados.append(json)
        self.timeouts.append(timeout)
        if not self.respostas:
            raise AssertionError('POST além do esperado')
        resposta = self.respostas.pop(0)
        if isinstance(resposta, Exception):
            raise resposta
        return resposta

    def close(self):
        pass


def _media(id_, titulo='Frieren', **extra):
    return {
        'id': id_, 'idMal': id_ + 1000, 'siteUrl': f'https://anilist.co/anime/{id_}',
        'title': {'romaji': titulo, 'english': None, 'native': None}, **extra,
    }


def _entrada(media, **extra):
    return {
        'status': 'CURRENT', 'score': 8.5, 'progress': 5,
        'startedAt': {'year': 2026, 'month': 10, 'day': 1},
        'completedAt': {'year': None, 'month': None, 'day': None},
        'media': media, **extra,
    }


def _colecao(*listas, proximo=False, nome='fulano'):
    return _Resposta(200, {'data': {'MediaListCollection': {
        'user': {'id': 1, 'name': nome}, 'hasNextChunk': proximo,
        'lists': [{'isCustomList': custom, 'entries': entradas} for custom, entradas in listas],
    }}})


def _erro(status, mensagem):
    corpo = {'errors': [{'message': mensagem, 'status': status}], 'data': {'MediaListCollection': None}}
    return _Resposta(status, corpo)


def test_conectar_devolve_o_nome_do_perfil_publico():
    sessao = SessaoFalsa(_colecao(nome='Fulano'))

    conta = AniList(sessao=sessao).conectar('  fulano ')

    assert conta == Conta('Fulano', 'Fulano')
    assert sessao.enviados[0]['variables']['usuario'] == 'fulano'


def test_conectar_aceita_a_url_do_perfil():
    sessao = SessaoFalsa(_colecao(nome='Fulano'))

    AniList(sessao=sessao).conectar('https://anilist.co/user/Fulano/animelist')

    assert sessao.enviados[0]['variables']['usuario'] == 'Fulano'


def test_perfil_inexistente_e_distinguivel():
    with pytest.raises(PerfilNaoEncontrado):
        AniList(sessao=SessaoFalsa(_erro(404, 'User not found'))).conectar('ninguem')


def test_perfil_privado_e_distinguivel():
    with pytest.raises(PerfilPrivado) as erro:
        AniList(sessao=SessaoFalsa(_erro(404, 'Private User'))).conectar('fulano')

    assert 'público' in str(erro.value)


def test_falha_da_origem_nao_parece_perfil_inexistente():
    with pytest.raises(OrigemIndisponivel):
        AniList(sessao=SessaoFalsa(_Resposta(500, {'errors': [{'message': 'oops', 'status': 500}]}))).conectar('fulano')
    with pytest.raises(OrigemIndisponivel):
        AniList(sessao=SessaoFalsa(ConnectionError('sem rede'))).conectar('fulano')


def test_nome_vazio_ou_invalido_nao_chega_na_rede():
    sessao = SessaoFalsa()
    with pytest.raises(PerfilNaoEncontrado):
        AniList(sessao=sessao).conectar('   ')
    with pytest.raises(PerfilNaoEncontrado):
        AniList(sessao=sessao).conectar('a b; drop')
    assert sessao.enviados == []


def test_ler_normaliza_anime_e_manga_e_ignora_listas_personalizadas():
    frieren = _media(1)
    berserk = _media(2, 'Berserk', siteUrl=None)
    sessao = SessaoFalsa(
        _colecao((False, [_entrada(frieren)]), (True, [_entrada(frieren)])),
        _colecao((False, [_entrada(berserk, status='COMPLETED', score=0, progress=380,
                                   completedAt={'year': 2025, 'month': 3, 'day': 9})])),
    )

    itens = AniList(sessao=sessao).ler(Conta('fulano'))

    assert [(i.tipo, i.origem_id) for i in itens] == [('anime', '1'), ('manga', '2')]
    anime, manga = itens
    assert (anime.titulo, anime.link, anime.status, anime.progresso, anime.nota) == (
        'Frieren', 'https://anilist.co/anime/1', EM_PROGRESSO, 5, 8.5,
    )
    assert anime.data_inicio == '2026-10-01' and anime.data_conclusao is None
    assert anime.catalogo.fonte == 'anilist' and anime.catalogo.id_fonte == '1'
    assert anime.catalogo.dados['idMal'] == 1001
    assert (manga.status, manga.nota, manga.progresso, manga.data_conclusao) == (CONCLUIDO, None, 380, '2025-03-09')
    assert manga.link == 'https://anilist.co/manga/2'
    assert [e['variables']['tipo'] for e in sessao.enviados] == ['ANIME', 'MANGA']
    assert 'POINT_10_DECIMAL' in sessao.enviados[0]['query']


def test_ler_segue_os_chunks():
    sessao = SessaoFalsa(
        _colecao((False, [_entrada(_media(1))]), proximo=True),
        _colecao((False, [_entrada(_media(2))])),
        _colecao(),
    )

    itens = AniList(sessao=sessao).ler(Conta('fulano'))

    assert [i.origem_id for i in itens] == ['1', '2']
    assert [e['variables']['chunk'] for e in sessao.enviados] == [1, 2, 1]


def test_data_parcial_fica_vazia():
    entrada = _entrada(_media(1), startedAt={'year': 2026, 'month': None, 'day': None})
    sessao = SessaoFalsa(_colecao((False, [entrada])), _colecao())

    assert AniList(sessao=sessao).ler(Conta('fulano'))[0].data_inicio is None
