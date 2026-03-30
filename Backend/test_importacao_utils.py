import json

from importacao import utils


def test_import_stats_merge_and_existing_count():
    anime = utils.ImportStats(tipo_midia='anime', origem='AniList')
    anime.registrar_sucesso()
    anime.registrar_sucesso(ja_existia=True)
    anime.registrar_falha()

    manga = utils.ImportStats(tipo_midia='manga', origem='AniList')
    manga.registrar_sucesso()

    anime.merge(manga)

    assert anime.processados == 4
    assert anime.sucessos == 3
    assert anime.falhas == 1
    assert anime.ja_existia == 1


def test_registrar_falha_importacao_escreve_jsonl(tmp_path, monkeypatch):
    error_log = tmp_path / 'importacao_erros.jsonl'
    monkeypatch.setattr(utils, 'ERROR_LOG_PATH', error_log)

    try:
        raise ValueError('falha controlada')
    except ValueError as exc:
        utils.registrar_falha_importacao(
            tipo_midia='manga',
            origem='AniList',
            exc=exc,
            identificador=123,
            titulo='Teste',
            payload={'campo': 'valor'},
            extra={'pagina': 2},
        )

    linhas = error_log.read_text(encoding='utf-8').strip().splitlines()
    assert len(linhas) == 1

    registro = json.loads(linhas[0])
    assert registro['tipo_midia'] == 'manga'
    assert registro['origem'] == 'AniList'
    assert registro['identificador'] == 123
    assert registro['titulo'] == 'Teste'
    assert registro['erro'] == 'falha controlada'
    assert registro['payload'] == {'campo': 'valor'}
    assert registro['extra'] == {'pagina': 2}
    assert 'ValueError' in registro['traceback']


def test_executar_em_paralelo_retorna_resultados_e_erros():
    def worker(item):
        if item == 2:
            raise RuntimeError('erro item 2')
        return item * 10

    resultados = list(utils.executar_em_paralelo([1, 2, 3], worker, max_workers=2))
    por_item = {item: (resultado, exc) for item, resultado, exc in resultados}

    assert por_item[1][0] == 10
    assert por_item[1][1] is None
    assert por_item[2][0] is None
    assert isinstance(por_item[2][1], RuntimeError)
    assert por_item[3][0] == 30
