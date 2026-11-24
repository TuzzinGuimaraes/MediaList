"""Normalização do email (ticket 36 da revisão, spec `login-ux`)."""
import pytest
from pydantic import BaseModel, ValidationError

from contrato import Email
from dominio.email import normalizar_email


@pytest.mark.parametrize(('entrada', 'esperado'), [
    ('fulano@exemplo.com', 'fulano@exemplo.com'),
    ('Fulano@Exemplo.COM', 'fulano@exemplo.com'),
    ('  fulano@exemplo.com \t\n', 'fulano@exemplo.com'),
    ('\u00a0fulano@exemplo.com\u00a0', 'fulano@exemplo.com'),
    ('\u200bfulano@exemplo.com\u200c', 'fulano@exemplo.com'),
    ('ful\u200dano@exem\u2060plo.com\ufeff', 'fulano@exemplo.com'),
    ('\ufeff\u00a0 Fulano@Exemplo.com\u200b ', 'fulano@exemplo.com'),
    # NFKC: formas de compatibilidade viram as comuns.
    ('ｆｕｌａｎｏ@ｅｘｅｍｐｌｏ.com', 'fulano@exemplo.com'),
])
def test_normaliza_caixa_espacos_e_invisiveis(entrada, esperado):
    assert normalizar_email(entrada) == esperado


def test_normalizar_e_idempotente():
    valor = normalizar_email('\u200b Fulano@Exemplo.com ')
    assert normalizar_email(valor) == valor


class _Corpo(BaseModel):
    email: Email


def test_campo_email_do_contrato_normaliza():
    assert _Corpo(email=' \u200bFulano@Exemplo.com\u00a0').email == 'fulano@exemplo.com'


@pytest.mark.parametrize('vazio', ['', '   ', '\u200b\u00a0'])
def test_campo_email_so_com_invisiveis_e_vazio(vazio):
    with pytest.raises(ValidationError):
        _Corpo(email=vazio)


def test_campo_email_que_nao_e_texto_e_invalido():
    with pytest.raises(ValidationError):
        _Corpo(email=123)
