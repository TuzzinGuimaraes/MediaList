import pytest

from database import get_db_connection


def _query_all(query, params=()):
    connection = get_db_connection()
    if not connection:
        pytest.skip('MySQL indisponivel para testes de contrato SQL')

    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [{str(key).lower(): value for key, value in row.items()} for row in rows]
    finally:
        cursor.close()
        connection.close()


def _query_one(query, params=()):
    rows = _query_all(query, params)
    return rows[0] if rows else None


def test_schema_removeu_musica_e_campos_legados():
    musica = _query_one(
        """
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = 'musicas'
        """
    )
    assert musica is None

    tipos = _query_all("SELECT nome_tipo FROM tipo_midia ORDER BY nome_tipo")
    assert [row['nome_tipo'] for row in tipos] == ['anime', 'jogo', 'manga']

    lista_columns = _query_all(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'lista_usuarios'
        """
    )
    nomes = {row['column_name'] for row in lista_columns}
    assert 'total_rewatches' in nomes
    assert 'privado' in nomes


def test_generos_e_status_nao_reintroduzem_musica():
    generos_invalidos = _query_all(
        """
        SELECT nome_genero, aplicavel_a
        FROM generos
        WHERE aplicavel_a LIKE '%musica%'
        """
    )
    assert generos_invalidos == []

    status_column = _query_one(
        """
        SELECT column_type
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'lista_usuarios'
          AND column_name = 'status_consumo'
        """
    )
    assert 'ouvindo' not in status_column['column_type']
    assert 'ouvido' not in status_column['column_type']


def test_procedures_e_views_essenciais_existem():
    procedures = _query_all(
        """
        SELECT routine_name
        FROM information_schema.routines
        WHERE routine_schema = DATABASE()
          AND routine_type = 'PROCEDURE'
        """
    )
    nomes = {row['routine_name'] for row in procedures}
    assert 'obter_estatisticas_usuario' in nomes

    views = _query_all(
        """
        SELECT table_name
        FROM information_schema.views
        WHERE table_schema = DATABASE()
        """
    )
    nomes_views = {row['table_name'] for row in views}
    assert 'vw_midias_populares' in nomes_views
    assert 'vw_perfil_usuario' in nomes_views


@pytest.mark.xfail(
    strict=False,
    reason=(
        'Aguarda a aplicação manual do schema: make db-dump, editar, make db-schema, '
        'make db-restore. Passa (XPASS) assim que o banco local for recriado; remova '
        'este marcador quando isso acontecer.'
    ),
)
def test_procedures_de_lista_sairam_do_schema():
    """O Estado de consumo é escrito pela aplicação (ADR-0004): as procedures que
    o banco usava para adicionar item e promover a Concluído não existem mais."""
    procedures = _query_all(
        """
        SELECT routine_name
        FROM information_schema.routines
        WHERE routine_schema = DATABASE()
          AND routine_type = 'PROCEDURE'
        """
    )
    nomes = {row['routine_name'] for row in procedures}
    assert 'adicionar_midia_lista' not in nomes
    assert 'atualizar_progresso_midia' not in nomes

    triggers = _query_all(
        """
        SELECT trigger_name
        FROM information_schema.triggers
        WHERE trigger_schema = DATABASE()
        """
    )
    nomes_triggers = {row['trigger_name'] for row in triggers}
    assert 'validar_progresso_lista' in nomes_triggers
    assert 'validar_progresso_lista_update' in nomes_triggers


def test_dados_estruturais_minimos_e_sem_seeds_exemplo():
    grupos = _query_one("SELECT COUNT(*) AS total FROM grupos_usuarios")
    generos = _query_one("SELECT COUNT(*) AS total FROM generos")
    placeholder_assets = _query_all(
        """
        SELECT titulo_original, poster_url, banner_url
        FROM midias
        WHERE poster_url LIKE 'https://example.com/%'
           OR banner_url LIKE 'https://example.com/%'
        """
    )

    assert grupos['total'] == 3
    assert generos['total'] >= 20
    assert placeholder_assets == []
