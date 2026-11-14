"""Infra do contrato da API (ticket 01 da spec contrato-api).

Envelope de erro `{erro, codigo, detalhes?}`, envelope de paginação, validação
das respostas contra o modelo e documentação OpenAPI.
"""
from datetime import timedelta

import pytest
from flask_jwt_extended import create_access_token
from pydantic import ValidationError as PydanticValidationError

from contrato import ConsultaPaginada, Pagina, detalhes_de_validacao, montar_pagina
from routes import utils as utils_routes
from schemas import ValidationError
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
# Validação legada (BaseSchema) no mesmo envelope
# ============================================

def test_validation_error_do_base_schema_vira_envelope(app):
    with app.test_request_context('/api/midias/X', method='PUT'):
        response = app.make_response(app.handle_user_exception(ValidationError({'generos': 'Tipo inválido'})))

    assert response.status_code == 400
    assert response.get_json() == {
        'erro': 'Dados inválidos', 'codigo': 'dados_invalidos', 'detalhes': {'generos': 'Tipo inválido'},
    }


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
