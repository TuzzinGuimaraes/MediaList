"""Infra do contrato da API (ticket 01 da spec contrato-api).

Envelope de erro `{erro, codigo, detalhes?}`, envelope de paginação, validação
das respostas contra o modelo e documentação OpenAPI.
"""
import json
import re
from datetime import timedelta

import pytest
from flask import Flask
from flask_jwt_extended import create_access_token
from pydantic import ValidationError as PydanticValidationError

import exportar_openapi
from contrato import (
    ConsultaPaginada,
    Erro,
    Pagina,
    contrato,
    detalhes_de_validacao,
    montar_pagina,
    registrar_documentacao,
)
from routes import utils as utils_routes
from schemas.utils import Genero

from .helpers import FakeCatalogo


def test_rota_inexistente_responde_404_no_envelope(client):
    response = client.get('/api/nao-existe')

    assert response.status_code == 404
    assert response.get_json() == {'erro': 'Endpoint não encontrado', 'codigo': 'nao_encontrado'}



# ============================================
# Envelope de erro nos loaders do flask-jwt (sem `msg`)
# ============================================

def test_rota_autenticada_sem_token_responde_401_no_envelope(client):
    response = client.get('/api/notificacoes')

    assert response.status_code == 401
    assert response.get_json() == {'erro': 'Faça login para continuar', 'codigo': 'nao_autenticado'}


def test_token_expirado_responde_401_no_envelope(client, app):
    with app.app_context():
        token = create_access_token(identity='USR-TEST-0001', expires_delta=timedelta(seconds=-1))

    response = client.get('/api/notificacoes', headers={'Authorization': f'Bearer {token}'})

    assert response.status_code == 401
    assert response.get_json() == {'erro': 'Sessão expirada', 'codigo': 'token_expirado'}


def test_token_malformado_responde_no_envelope(client):
    response = client.get('/api/notificacoes', headers={'Authorization': 'Bearer nao-e-um-jwt'})

    assert response.status_code == 422
    assert response.get_json() == {'erro': 'Token inválido', 'codigo': 'token_invalido'}



# ============================================
# Rota de referência: GET /api/generos
# ============================================

@pytest.fixture
def generos(monkeypatch):
    def _instalar(*lista):
        catalogo = FakeCatalogo(generos=list(lista))
        monkeypatch.setattr(utils_routes, 'catalogo', catalogo)
        return catalogo

    return _instalar


def test_generos_sai_pelo_modelo_com_id_como_texto_e_sem_campo_legado(client, generos):
    generos({'id_genero': 7, 'nome_genero': 'Ação', 'descricao': None, 'aplicavel_a': ['anime', 'jogo']})

    response = client.get('/api/generos')

    assert response.status_code == 200
    assert response.get_json() == {
        'generos': [{'id_genero': '7', 'nome_genero': 'Ação', 'aplicavel_a': ['anime', 'jogo']}],
    }


def test_generos_com_tipo_desconhecido_responde_400_traduzido(client, generos):
    catalogo = generos()

    response = client.get('/api/generos?tipo=nim')

    assert response.status_code == 400
    assert response.get_json() == {
        'erro': 'Dados inválidos',
        'codigo': 'dados_invalidos',
        'detalhes': {'tipo': 'Valor fora dos permitidos'},
    }
    assert catalogo.chamadas == []


def test_resposta_fora_do_modelo_falha_nos_testes(client, generos):
    generos({'id_genero': 7, 'aplicavel_a': ['anime']})  # sem nome_genero

    response = client.get('/api/generos')

    assert response.status_code == 500


def test_resposta_fora_do_modelo_em_producao_sai_como_veio_e_vai_para_o_log(app, client, generos, caplog):
    app.config['CONTRATO_RESPOSTA_ESTRITA'] = False
    generos({'id_genero': 7, 'aplicavel_a': ['anime']})

    response = client.get('/api/generos')

    assert response.status_code == 200
    assert response.get_json() == {'generos': [{'id_genero': 7, 'aplicavel_a': ['anime']}]}
    assert 'Resposta fora do contrato em GET /api/generos' in caplog.text
    assert 'nome_genero' in caplog.text


def test_generos_com_tipo_vazio_e_como_sem_tipo(client, generos):
    """Parâmetro de query vazio vale como ausente, como em `parametros.ler_int`."""
    catalogo = generos()

    assert client.get('/api/generos?tipo=').status_code == 200
    assert catalogo.chamadas == [('generos', None)]


# ============================================
# Envelope de paginação
# ============================================

def test_montar_pagina_monta_o_envelope_e_cabe_em_pagina_do_modelo():
    corpo = montar_pagina([{'id_genero': 1, 'nome_genero': 'Ação', 'aplicavel_a': ['anime']}], 41, 3, 20)

    assert corpo == {
        'itens': [{'id_genero': 1, 'nome_genero': 'Ação', 'aplicavel_a': ['anime']}],
        'pagina': 3,
        'por_pagina': 20,
        'total': 41,
    }
    assert Pagina[Genero].model_validate(corpo).model_dump(mode='json')['itens'][0]['id_genero'] == '1'


def test_consulta_paginada_segue_as_regras_de_ler_paginacao():
    assert ConsultaPaginada.model_validate({}).model_dump() == {'pagina': 1, 'por_pagina': 20}
    assert ConsultaPaginada.model_validate({'pagina': '2', 'por_pagina': '999'}).model_dump() == {
        'pagina': 2, 'por_pagina': 50,
    }
    with pytest.raises(PydanticValidationError) as erro:
        ConsultaPaginada.model_validate({'pagina': '0', 'por_pagina': 'abc'})
    assert detalhes_de_validacao(erro.value.errors()) == {
        'pagina': 'Deve ser maior ou igual a 1',
        'por_pagina': 'Tipo inválido',
    }



# ============================================
# Documentação OpenAPI
# ============================================

def test_openapi_fora_de_producao_traz_a_rota_de_referencia_e_o_enum_de_erro(client):
    response = client.get('/api/openapi.json')

    assert response.status_code == 200
    documento = response.get_json()
    assert '/api/generos' in documento['paths']
    assert set(documento['components']['schemas']['CodigoErro']['enum']) >= {'nao_encontrado', 'dados_invalidos'}


def _operacoes(app):
    """(método, rota do OpenAPI, operação, função da view) de cada rota documentada."""
    documento = contrato.spec
    for regra in app.url_map.iter_rules():
        caminho = re.sub(r'<(?:[^:<>]+:)?([^<>]+)>', r'{\1}', regra.rule)
        for metodo in sorted((regra.methods or set()) - {'HEAD', 'OPTIONS'}):
            operacao = documento['paths'].get(caminho, {}).get(metodo.lower())
            if operacao:
                yield metodo, caminho, operacao, app.view_functions[regra.endpoint]


def test_toda_rota_autenticada_declara_401_e_422_do_token(app):
    with app.app_context():
        autenticadas = [(m, c, op) for m, c, op, _ in _operacoes(app) if op.get('security')]

    assert len(autenticadas) > 20
    faltando = [(m, c) for m, c, op in autenticadas if not {'401', '422'} <= set(op['responses'])]
    assert faltando == []


def test_toda_rota_com_permissao_declara_403(app):
    with app.app_context():
        com_permissao = [(m, c, op) for m, c, op, view in _operacoes(app) if getattr(view, 'exige_permissao', False)]

    assert {(m, c) for m, c, _ in com_permissao} >= {
        ('POST', '/api/noticias'), ('GET', '/api/moderacao/avaliacoes'), ('GET', '/api/moderacao/usuarios'),
        ('PUT', '/api/midias/{id_midia}'), ('DELETE', '/api/midias/{id_midia}'),
    }
    assert [(m, c) for m, c, op in com_permissao if '403' not in op['responses']] == []


def test_docs_fora_de_producao(client):
    response = client.get('/api/docs', follow_redirects=True)

    assert response.status_code == 200
    assert b'swagger' in response.data.lower()
    assert client.get('/api/docs/redoc/').status_code == 200


def test_docs_e_openapi_nao_existem_em_producao():
    app_producao = Flask(__name__)
    registrar_documentacao(app_producao, em_producao=True)
    cliente = app_producao.test_client()

    assert cliente.get('/api/openapi.json').status_code == 404
    assert cliente.get('/api/docs').status_code == 404
    assert cliente.get('/api/docs/swagger/').status_code == 404



def test_exportador_grava_o_openapi_sem_servidor_nem_banco(tmp_path):
    destino = tmp_path / 'contrato' / 'openapi.json'

    exportar_openapi.main(['exportar_openapi.py', str(destino)])

    documento = json.loads(destino.read_text(encoding='utf-8'))
    assert '/api/generos' in documento['paths']
    assert destino.read_text(encoding='utf-8') == exportar_openapi.documento()



def test_erro_serializado_pelo_modelo_omite_detalhes_vazios():
    """Rota que declara `HTTP_404=Erro` sai igual ao `resposta_erro`: sem `detalhes: null`."""
    assert Erro(erro='Mídia não encontrada', codigo='nao_encontrado').model_dump(mode='json') == {
        'erro': 'Mídia não encontrada', 'codigo': 'nao_encontrado',
    }
