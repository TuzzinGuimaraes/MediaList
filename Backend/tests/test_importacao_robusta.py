"""Importação robusta (ticket 08): rate limit, páginas com falha, RAWG sem chave, segredo fora do log."""
import requests

from importacao import anilist


class _Resposta:
    def __init__(self, status_code, corpo=None, headers=None, url='https://exemplo.test/'):
        self.status_code = status_code
        self._corpo = corpo
        self.headers = headers or {}
        self.url = url

    def json(self):
        return self._corpo

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError(f'{self.status_code} Client Error for url: {self.url}', response=self)


class _SessaoFixa:
    """Sessão simulada que devolve sempre a mesma resposta."""

    def __init__(self, resposta):
        self.resposta = resposta
        self.chamadas = 0

    def post(self, *args, **kwargs):
        self.chamadas += 1
        if self.chamadas > 10:
            raise KeyboardInterrupt('sessão chamada demais: laço sem limite')
        return self.resposta

    get = post

    def close(self):
        pass


class _SemEspera:
    def wait(self):
        pass


def test_anilist_429_persistente_vira_pagina_com_falha_sem_laco():
    """O Retry da sessão já trata 429; esgotado, a página falha e o laço segue."""
    sessao = _SessaoFixa(_Resposta(429, headers={'Retry-After': '60'}))

    try:
        paginas = list(anilist.importar_do_anilist('ANIME', paginas=2, session=sessao, rate_limiter=_SemEspera()))
    except KeyboardInterrupt as exc:
        raise AssertionError(str(exc)) from None

    assert [p['pagina'] for p in paginas] == [1, 2]
    assert all(p['erro'] is not None for p in paginas)
    assert sessao.chamadas == 2


def test_sessao_http_desiste_do_429_apos_limite_de_tentativas():
    """Servidor local que sempre responde 429: a sessão tenta 1 + 3 vezes e devolve o 429."""
    import threading
    from http.server import BaseHTTPRequestHandler, HTTPServer

    from importacao.utils import criar_sessao_http

    hits = []

    class Sempre429(BaseHTTPRequestHandler):
        def do_POST(self):
            hits.append(1)
            self.rfile.read(int(self.headers.get('Content-Length', 0)))
            self.send_response(429)
            self.send_header('Retry-After', '0')
            self.send_header('Content-Length', '0')
            self.end_headers()

        def log_message(self, *args):
            pass

    servidor = HTTPServer(('127.0.0.1', 0), Sempre429)
    threading.Thread(target=servidor.serve_forever, daemon=True).start()
    try:
        sessao = criar_sessao_http(total_retries=3, backoff_factor=0)
        resposta = sessao.post(f'http://127.0.0.1:{servidor.server_port}/', json={}, timeout=5)
    finally:
        servidor.shutdown()

    assert resposta.status_code == 429
    assert len(hits) == 4



class _ConexaoFalsa:
    def close(self):
        pass


def _rodar_main(monkeypatch, *argv):
    import sys

    from importacao import run_import

    monkeypatch.setattr(sys, 'argv', ['run_import', *argv])
    run_import.main()


def test_pagina_com_falha_aparece_no_resumo(monkeypatch, capsys, tmp_path):
    from importacao import importar_animes, importar_mangas, utils

    monkeypatch.setattr(utils, 'ERROR_LOG_PATH', tmp_path / 'erros.jsonl')

    def fonte(tipo, paginas, **kwargs):
        yield {'pagina': 1, 'itens': [], 'erro': None}
        yield {'pagina': 2, 'itens': [], 'erro': RuntimeError('timeout'), 'payload': {}}

    for modulo in (importar_animes, importar_mangas):
        monkeypatch.setattr(modulo, 'importar_do_anilist', fonte)
        monkeypatch.setattr(modulo, 'get_connection', _ConexaoFalsa)

    _rodar_main(monkeypatch, '--tipo', 'anime')
    _rodar_main(monkeypatch, '--tipo', 'manga')

    saida = capsys.readouterr().out
    assert 'anime: processados=0 sucessos=0 falhas=0 ja_existia=0 paginas_com_falha=[2]' in saida
    assert 'manga: processados=0 sucessos=0 falhas=0 ja_existia=0 paginas_com_falha=[2]' in saida



CHAVE = 'chave-rawg-secreta-123'


def _preparar_jogos(monkeypatch, tmp_path, sessao, chave=CHAVE):
    from importacao import importar_jogos, utils

    monkeypatch.setattr(utils, 'ERROR_LOG_PATH', tmp_path / 'erros.jsonl')
    monkeypatch.setattr(importar_jogos, 'RAWG_API_KEY', chave)
    monkeypatch.setattr(importar_jogos, 'get_connection', _ConexaoFalsa)
    monkeypatch.setattr(importar_jogos, 'criar_sessao_http', lambda **kw: sessao)
    return importar_jogos


def test_pagina_de_jogos_com_falha_aparece_no_resumo(monkeypatch, capsys, tmp_path):
    url = f'https://api.rawg.io/api/games?key={CHAVE}&page=1'
    _preparar_jogos(monkeypatch, tmp_path, _SessaoFixa(_Resposta(502, url=url)))

    _rodar_main(monkeypatch, '--tipo', 'jogo', '--paginas', '2')

    saida = capsys.readouterr().out
    assert 'jogo: processados=0 sucessos=0 falhas=0 ja_existia=0 paginas_com_falha=[1, 2]' in saida
