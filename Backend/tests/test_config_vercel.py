"""Headers de segurança: o vercel.json (produção) repete os do nginx.conf (dev).

Se alguém mudar a CSP (ou outro header) de um lado só, o dev deixa de refletir a
produção (ADR-0013). Este teste lê os dois arquivos e compara.
"""
import json
import pathlib
import re

RAIZ = pathlib.Path(__file__).resolve().parents[2]
HSTS = 'max-age=63072000; includeSubDomains'


def _headers_nginx():
    texto = (RAIZ / 'Web' / 'nginx.conf').read_text(encoding='utf-8')
    return dict(re.findall(r'^\s*add_header\s+(\S+)\s+"([^"]*)"\s+always;', texto, re.MULTILINE))


def _headers_vercel():
    config = json.loads((RAIZ / 'vercel.json').read_text(encoding='utf-8'))
    regras = [regra for regra in config['headers'] if regra['source'] == '/(.*)']
    assert len(regras) == 1, 'vercel.json: esperada uma regra de headers para /(.*)'
    return {h['key']: h['value'] for h in regras[0]['headers']}


def test_nginx_tem_os_headers_de_seguranca():
    assert 'Content-Security-Policy' in _headers_nginx()


def test_csp_do_vercel_igual_a_do_nginx():
    assert _headers_vercel()['Content-Security-Policy'] == _headers_nginx()['Content-Security-Policy']


def test_vercel_repete_todos_os_headers_do_nginx_mais_hsts():
    esperado = {**_headers_nginx(), 'Strict-Transport-Security': HSTS}
    assert _headers_vercel() == esperado
