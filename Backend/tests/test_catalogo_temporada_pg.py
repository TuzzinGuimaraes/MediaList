"""Temporada no Catálogo (spec `temporada`): `GET /midias` por Temporada e pelos mais esperados
(Popularidade da fonte), e a Temporada mais antiga nas facetas, no PostgreSQL real.

Usa TEST_DATABASE_URL; sem ela, pula. O banco pode ter outras Mídias: os testes usam anos que
nenhuma outra tem (2600 e 1800).
"""
import uuid

import pytest

import banco
from repositories import Catalogo

from .test_repositorios_pg import TEST_DATABASE_URL

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para a Temporada'
)


def _anime(pg, temporada=None, formato=None, popularidade=None, estimada=False, nota_fonte=None, **dados):
    """Um anime do Catálogo com Temporada, formato, Popularidade e Nota da fonte (que só a Importação grava)."""
    id_midia = Catalogo().criar('anime', {'titulo_original': f'Temporada {uuid.uuid4().hex}', **dados})
    pg['midias'].append(id_midia)
    estacao, ano = temporada or (None, None)
    banco.executar(
        'UPDATE animes SET temporada_estacao = %s, temporada_ano = %s, formato = %s, popularidade_fonte = %s, '
        'temporada_estimada = %s WHERE id_midia = %s',
        (estacao, ano, formato, popularidade, estimada, id_midia),
    )
    banco.executar('UPDATE midias SET nota_fonte = %s WHERE id_midia = %s', (nota_fonte, id_midia))
    return id_midia


def test_lista_a_temporada_pelos_mais_esperados(client, pg):
    esperado = _anime(pg, ('outono', 2600), 'TV', 900)
    menos = _anime(pg, ('outono', 2600), 'MOVIE', 40, estimada=True)
    sem_popularidade = _anime(pg, ('outono', 2600))
    _anime(pg, ('verao', 2600), 'TV', 5000)
    _anime(pg, ('outono', 2601), 'TV', 5000)
    _anime(pg, None, 'TV', 5000)

    resposta = client.get('/api/midias?tipo=anime&temporada_estacao=outono&temporada_ano=2600'
                          '&ordem=popularidade_fonte')

    assert resposta.status_code == 200
    corpo = resposta.get_json()
    assert corpo['total'] == 3
    assert [m['id_midia'] for m in corpo['itens']] == [esperado, menos, sem_popularidade]
    assert {k: corpo['itens'][1][k] for k in ('temporada_estacao', 'temporada_ano', 'formato', 'temporada_estimada')} \
        == {'temporada_estacao': 'outono', 'temporada_ano': 2600, 'formato': 'MOVIE', 'temporada_estimada': True}
    assert corpo['itens'][2]['formato'] is None


def test_temporada_vale_sem_tipo_e_so_traz_animes(client, pg):
    anime = _anime(pg, ('inverno', 2600), popularidade=1)

    corpo = client.get('/api/midias?temporada_estacao=inverno&temporada_ano=2600').get_json()

    assert [m['id_midia'] for m in corpo['itens']] == [anime]


def test_midia_de_outro_tipo_sai_sem_temporada(client, pg):
    id_jogo = Catalogo().criar('jogo', {'titulo_original': f'Jogo {uuid.uuid4().hex}'})
    pg['midias'].append(id_jogo)

    jogo = client.get(f'/api/midias/{id_jogo}').get_json()

    assert {k: jogo[k] for k in ('temporada_estacao', 'temporada_ano', 'formato', 'temporada_estimada')} == {
        'temporada_estacao': None, 'temporada_ano': None, 'formato': None, 'temporada_estimada': None,
    }


def test_ordem_estreia_vai_da_mais_cedo_para_a_mais_tarde_e_sem_data_no_fim(client, pg):
    sem_data = _anime(pg, ('primavera', 2600))
    tarde = _anime(pg, ('primavera', 2600), data_lancamento='2600-06-20')
    empate_a = _anime(pg, ('primavera', 2600), data_lancamento='2600-04-05')
    empate_b = _anime(pg, ('primavera', 2600), data_lancamento='2600-04-05')
    cedo = _anime(pg, ('primavera', 2600), data_lancamento='2600-04-01')

    corpo = client.get('/api/midias?temporada_estacao=primavera&temporada_ano=2600&ordem=estreia').get_json()

    assert [m['id_midia'] for m in corpo['itens']] == [cedo, *sorted([empate_a, empate_b]), tarde, sem_data]


@pytest.mark.parametrize('consulta', [
    'temporada_estacao=outono',
    'temporada_ano=2600',
    'temporada_estacao=moncao&temporada_ano=2600',
    'temporada_estacao=outono&temporada_ano=0',
    'ordem=mais_esperados',
])
def test_temporada_pela_metade_ou_invalida_responde_400(client, consulta):
    resposta = client.get(f'/api/midias?{consulta}')

    assert resposta.status_code == 400
    assert resposta.get_json()['codigo'] == 'dados_invalidos'


def test_facetas_dos_animes_trazem_a_temporada_mais_antiga(client, pg):
    # Outono vem antes de primavera no alfabeto, não no ano.
    _anime(pg, ('outono', 1800))
    _anime(pg, ('primavera', 1800))
    _anime(pg, ('inverno', 1801))

    for consulta in ('?tipo=anime', ''):
        corpo = client.get(f'/api/midias/facetas{consulta}').get_json()
        assert corpo['temporada_mais_antiga'] == {'estacao': 'primavera', 'ano': 1800}


@pytest.mark.parametrize('tipo', ['manga', 'jogo'])
def test_facetas_fora_dos_animes_vem_sem_temporada(client, pg, tipo):
    _anime(pg, ('outono', 1800))

    assert client.get(f'/api/midias/facetas?tipo={tipo}').get_json()['temporada_mais_antiga'] is None



def test_ordem_nota_fonte_vai_da_maior_para_a_menor_e_sem_nota_no_fim(client, pg):
    sem_nota = _anime(pg, ('verao', 2602))
    baixa = _anime(pg, ('verao', 2602), nota_fonte=5.5)
    empate_a = _anime(pg, ('verao', 2602), nota_fonte=8.0)
    empate_b = _anime(pg, ('verao', 2602), nota_fonte=8.0)
    alta = _anime(pg, ('verao', 2602), nota_fonte=9.1)

    corpo = client.get('/api/midias?temporada_estacao=verao&temporada_ano=2602&ordem=nota_fonte').get_json()

    assert [m['id_midia'] for m in corpo['itens']] == [alta, *sorted([empate_a, empate_b]), baixa, sem_nota]
