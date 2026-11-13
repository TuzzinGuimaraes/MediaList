"""Contrato do schema aplicado pelas migrações (Backend/migrations) no PostgreSQL.

Roda contra um banco real com `alembic upgrade head` já aplicado, conectando
como o usuário da aplicação (só DML). A URL vem de TEST_DATABASE_URL, por
exemplo postgresql://media_app_user:...@127.0.0.1:5433/medialist_db; sem ela,
o módulo inteiro é pulado. Cada teste roda numa transação desfeita no fim.
"""
import os
from decimal import Decimal

import pytest

psycopg = pytest.importorskip('psycopg')
from psycopg import errors  # noqa: E402
from psycopg.rows import dict_row  # noqa: E402

TEST_DATABASE_URL = os.getenv('TEST_DATABASE_URL')

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL, reason='TEST_DATABASE_URL ausente: sem PostgreSQL para o contrato SQL'
)

TABELAS = {
    'tipo_midia', 'usuarios', 'grupos_usuarios', 'usuarios_grupos', 'midias', 'animes',
    'jogos', 'mangas', 'generos', 'midias_generos', 'lista_usuarios', 'avaliacoes',
    'comentarios_avaliacoes', 'refresh_tokens', 'noticias', 'atualizacoes_midia',
    'notificacoes',
}
VIEWS = {'vw_notas_midia', 'vw_midias_populares', 'vw_animes_temporada_atual', 'vw_perfil_usuario'}


@pytest.fixture
def db():
    with psycopg.connect(TEST_DATABASE_URL, row_factory=dict_row) as conn:
        try:
            yield conn
        finally:
            conn.rollback()


def _todos(conn, query, params=()):
    return conn.execute(query, params).fetchall()


def _um(conn, query, params=()):
    return conn.execute(query, params).fetchone()


def _colunas(conn, tabela):
    rows = _todos(
        conn,
        """
        SELECT column_name, data_type, udt_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s
        """,
        (tabela,),
    )
    return {row['column_name']: row for row in rows}


def _usuario(conn, email='contrato@exemplo.test'):
    return _um(
        conn,
        "INSERT INTO usuarios (nome_completo, email, senha_hash) VALUES ('Contrato', %s, 'x') "
        'RETURNING id_usuario',
        (email,),
    )['id_usuario']


def _midia(conn, tipo='anime', titulo='Mídia de contrato'):
    return _um(
        conn,
        """
        INSERT INTO midias (id_tipo, titulo_original)
        SELECT id_tipo, %s FROM tipo_midia WHERE nome_tipo = %s
        RETURNING id_midia
        """,
        (titulo, tipo),
    )['id_midia']


def test_tabelas_e_views_da_baseline(db):
    tabelas = {
        row['table_name']
        for row in _todos(
            db,
            "SELECT table_name FROM information_schema.tables "
            "WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
        )
    }
    assert TABELAS <= tabelas
    assert 'sequences' not in tabelas
    assert 'musicas' not in tabelas

    views = {
        row['table_name']
        for row in _todos(db, "SELECT table_name FROM information_schema.views WHERE table_schema = 'public'")
    }
    assert VIEWS <= views


def test_colunas_que_mudaram_com_as_decisoes(db):
    midias = _colunas(db, 'midias')
    assert 'nota_media' not in midias
    assert 'total_avaliacoes' not in midias
    assert midias['nota_fonte']['data_type'] == 'numeric'
    assert midias['id_midia']['data_type'] == 'uuid'

    assert 'codigo_usuario' not in _colunas(db, 'usuarios')
    assert 'codigo_avaliacao' not in _colunas(db, 'avaliacoes')
    assert _colunas(db, 'usuarios')['preferencias']['data_type'] == 'jsonb'
    assert _colunas(db, 'jogos')['plataformas']['udt_name'] == '_text'
    assert _colunas(db, 'generos')['aplicavel_a']['udt_name'] == '_text'

    lista = _colunas(db, 'lista_usuarios')
    assert {'total_rewatches', 'privado', 'status_consumo'} <= set(lista)


def test_dados_estruturais_semeados(db):
    tipos = _todos(db, 'SELECT nome_tipo FROM tipo_midia ORDER BY nome_tipo')
    assert [row['nome_tipo'] for row in tipos] == ['anime', 'jogo', 'manga']
    assert _um(db, 'SELECT count(*) AS total FROM grupos_usuarios')['total'] == 3
    assert _um(db, 'SELECT count(*) AS total FROM generos')['total'] >= 20
    assert _um(db, "SELECT count(*) AS total FROM generos WHERE 'musica' = ANY (aplicavel_a)")['total'] == 0


def test_sem_procedures_e_so_a_funcao_de_data_atualizacao(db):
    rotinas = _todos(
        db,
        """
        SELECT p.proname, p.prokind
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
        """,
    )
    assert {(row['proname'], row['prokind']) for row in rotinas} == {('definir_data_atualizacao', 'f')}


def test_refresh_tokens_guarda_so_o_hash(db):
    """ADR-0006: a tabela tem a cadeia de rotação e nenhuma coluna para o token em claro."""
    assert set(_colunas(db, 'refresh_tokens')) == {
        'id_refresh', 'token_hash', 'id_usuario', 'familia',
        'criado_em', 'expira_em', 'revogado', 'substituido_por',
    }


def test_nota_aceita_dez_e_recusa_acima(db):
    usuario = _usuario(db)
    midia = _midia(db)
    db.execute('INSERT INTO avaliacoes (id_usuario, id_midia, nota) VALUES (%s, %s, 10)', (usuario, midia))

    outra = _midia(db, titulo='Outra mídia')
    with pytest.raises(errors.CheckViolation), db.transaction():
        db.execute('INSERT INTO avaliacoes (id_usuario, id_midia, nota) VALUES (%s, %s, 10.1)', (usuario, outra))
    with pytest.raises(errors.CheckViolation), db.transaction():
        db.execute("UPDATE midias SET nota_fonte = 10.1 WHERE id_midia = %s", (midia,))


def test_rotulo_invalido_e_progresso_negativo_recusados(db):
    usuario = _usuario(db)
    midia = _midia(db)
    with pytest.raises(errors.CheckViolation), db.transaction():
        db.execute(
            "INSERT INTO lista_usuarios (id_usuario, id_midia, status_consumo) VALUES (%s, %s, 'ouvindo')",
            (usuario, midia),
        )
    with pytest.raises(errors.CheckViolation), db.transaction():
        db.execute(
            "INSERT INTO lista_usuarios (id_usuario, id_midia, status_consumo, progresso_atual) "
            "VALUES (%s, %s, 'assistindo', -1)",
            (usuario, midia),
        )
    # O conjunto é global (ADR-0002): o banco aceita qualquer Rótulo dos três Tipos.
    db.execute(
        "INSERT INTO lista_usuarios (id_usuario, id_midia, status_consumo) VALUES (%s, %s, 'platinado')",
        (usuario, midia),
    )


def test_view_de_notas_calcula_media_e_devolve_null_sem_avaliacoes(db):
    midia = _midia(db)
    sql = 'SELECT nota_media, total_avaliacoes FROM vw_notas_midia WHERE id_midia = %s'
    assert _um(db, sql, (midia,)) == {'nota_media': None, 'total_avaliacoes': None}

    for indice, nota in enumerate(('8.0', '9.5')):
        usuario = _usuario(db, email=f'nota{indice}@exemplo.test')
        db.execute('INSERT INTO avaliacoes (id_usuario, id_midia, nota) VALUES (%s, %s, %s)', (usuario, midia, nota))

    assert _um(db, sql, (midia,)) == {'nota_media': Decimal('8.75'), 'total_avaliacoes': 2}


def test_usuario_da_aplicacao_nao_faz_ddl(db):
    with pytest.raises(errors.InsufficientPrivilege), db.transaction():
        db.execute('CREATE TABLE contrato_ddl (id integer)')
    with pytest.raises(errors.InsufficientPrivilege), db.transaction():
        db.execute('ALTER TABLE midias ADD COLUMN contrato_ddl integer')
    with pytest.raises(errors.InsufficientPrivilege), db.transaction():
        db.execute('DROP TABLE noticias')
