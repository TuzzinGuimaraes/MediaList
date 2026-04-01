"""
Acesso ao banco para scripts de importação.
"""
from __future__ import annotations

import mysql.connector

from importacao.config import DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT, DB_USER


def get_connection():
    return mysql.connector.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        charset='utf8mb4',
        use_unicode=True,
    )


def _callproc(cursor, proc_name, params):
    return cursor.callproc(proc_name, params)


def upsert_genero(
    conn,
    nome_genero: str,
    aplicavel_a: str = 'anime,manga,jogo',
    genero_cache: dict[str, int] | None = None,
) -> int:
    nome_genero = nome_genero.strip()
    if genero_cache is not None and nome_genero in genero_cache:
        return genero_cache[nome_genero]

    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id_genero FROM generos WHERE nome_genero = %s", (nome_genero,))
        row = cursor.fetchone()
        if row:
            genero_id = row[0]
        else:
            cursor.execute(
                "INSERT INTO generos (nome_genero, descricao, aplicavel_a) VALUES (%s, %s, %s)",
                (nome_genero, None, aplicavel_a),
            )
            genero_id = cursor.lastrowid

        if genero_cache is not None:
            genero_cache[nome_genero] = genero_id
        return genero_id
    finally:
        cursor.close()


def inserir_midia_genero(conn, id_midia: str, id_genero: int):
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT IGNORE INTO midias_generos (id_midia, id_genero) VALUES (%s, %s)",
            (id_midia, id_genero),
        )
    finally:
        cursor.close()


def inserir_ou_atualizar_anime(conn, dados: dict) -> dict:
    cursor = conn.cursor()
    try:
        result = _callproc(
            cursor,
            'inserir_ou_atualizar_anime',
            [
                dados['titulo_original'],
                dados.get('titulo_ingles'),
                dados.get('titulo_portugues'),
                dados.get('sinopse'),
                dados.get('data_lancamento'),
                dados.get('status_anime'),
                dados.get('numero_episodios'),
                dados.get('duracao_episodio'),
                dados.get('classificacao_etaria'),
                dados.get('nota_media'),
                dados.get('poster_url'),
                dados.get('banner_url'),
                dados.get('estudio'),
                dados.get('fonte_original'),
                dados.get('anilist_id'),
                '',
                False,
            ],
        )
    finally:
        cursor.close()
    return {'id_midia': result[15], 'ja_existia': bool(result[16])}


def inserir_ou_atualizar_manga(conn, dados: dict) -> dict:
    cursor = conn.cursor()
    try:
        result = _callproc(
            cursor,
            'inserir_ou_atualizar_manga',
            [
                dados['titulo_original'],
                dados.get('titulo_ingles'),
                dados.get('titulo_portugues'),
                dados.get('sinopse'),
                dados.get('data_lancamento'),
                dados.get('nota_media'),
                dados.get('poster_url'),
                dados.get('banner_url'),
                dados.get('status_manga'),
                dados.get('numero_capitulos'),
                dados.get('numero_volumes'),
                dados.get('autor'),
                dados.get('artista'),
                dados.get('publicadora_original'),
                dados.get('revista'),
                dados.get('demografia'),
                dados.get('anilist_id'),
                '',
                False,
            ],
        )
    finally:
        cursor.close()
    return {'id_midia': result[17], 'ja_existia': bool(result[18])}


def inserir_ou_atualizar_jogo(conn, dados: dict) -> dict:
    cursor = conn.cursor()
    try:
        result = _callproc(
            cursor,
            'inserir_ou_atualizar_jogo',
            [
                dados['titulo_original'],
                dados.get('titulo_portugues'),
                dados.get('sinopse'),
                dados.get('data_lancamento'),
                dados.get('nota_media'),
                dados.get('poster_url'),
                dados.get('banner_url'),
                dados.get('desenvolvedor'),
                dados.get('publicadora'),
                dados.get('plataformas'),
                dados.get('status_jogo'),
                dados.get('modo_jogo'),
                dados.get('classificacao'),
                dados.get('trailer_url'),
                dados.get('rawg_slug'),
                '',
                False,
            ],
        )
    finally:
        cursor.close()
    return {'id_midia': result[15], 'ja_existia': bool(result[16])}
