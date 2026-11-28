"""Conquistas da Steam (spec `conquistas-steam`, Q230–Q247).

Só a sincronização da Steam escreve as três primeiras; os destaques são do Usuário.

- `conquistas_esquemas` e `conquistas`: o esquema de cada jogo pela `steam_appid`, compartilhado
  entre Usuários (código, nome e descrição em português quando a Steam tem, ícones, oculta e a
  raridade em % dos jogadores), com o total e quando foi lido. Jogo sem conquistas fica com total 0.
- `conquistas_itens` e `conquistas_obtidas`: a última leitura de cada Item de jogo (o total do
  jogo naquela leitura e as horas da Steam, para saber se elas subiram) e as conquistas obtidas,
  com a data. Saem com o Item.
- `conquistas_destaques`: as conquistas obtidas que o Usuário destaca no Perfil (o limite de 6 é
  da aplicação). A FK para a obtida leva o destaque junto quando a Steam deixa de listá-la.

O downgrade apaga as tabelas.

Revision ID: 0021_conquistas
Revises: 0020_recomendacoes
Create Date: 2026-11-28
"""
from alembic import op

revision = '0021_conquistas'
down_revision = '0020_recomendacoes'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE conquistas_esquemas (
            steam_appid bigint PRIMARY KEY CONSTRAINT ck_conquistas_esquemas_appid CHECK (steam_appid > 0),
            total integer NOT NULL CONSTRAINT ck_conquistas_esquemas_total CHECK (total >= 0),
            lido_em timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE conquistas (
            steam_appid bigint NOT NULL REFERENCES conquistas_esquemas (steam_appid) ON DELETE CASCADE,
            codigo text NOT NULL CONSTRAINT ck_conquistas_codigo CHECK (codigo <> ''),
            nome text NOT NULL,
            descricao text,
            icone text,
            icone_cinza text,
            oculta boolean NOT NULL DEFAULT false,
            raridade double precision
                CONSTRAINT ck_conquistas_raridade CHECK (raridade >= 0 AND raridade <= 100),
            CONSTRAINT pk_conquistas PRIMARY KEY (steam_appid, codigo)
        );

        CREATE TABLE conquistas_itens (
            id_lista uuid PRIMARY KEY REFERENCES lista_usuarios (id_lista) ON DELETE CASCADE,
            steam_appid bigint NOT NULL REFERENCES conquistas_esquemas (steam_appid),
            total integer NOT NULL CONSTRAINT ck_conquistas_itens_total CHECK (total >= 0),
            horas_lidas integer NOT NULL CONSTRAINT ck_conquistas_itens_horas CHECK (horas_lidas >= 0),
            lido_em timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE conquistas_obtidas (
            id_lista uuid NOT NULL REFERENCES conquistas_itens (id_lista) ON DELETE CASCADE,
            codigo text NOT NULL,
            obtida_em timestamptz,
            CONSTRAINT pk_conquistas_obtidas PRIMARY KEY (id_lista, codigo)
        );

        CREATE TABLE conquistas_destaques (
            id_lista uuid NOT NULL,
            codigo text NOT NULL,
            destacada_em timestamptz NOT NULL DEFAULT now(),
            CONSTRAINT pk_conquistas_destaques PRIMARY KEY (id_lista, codigo),
            CONSTRAINT fk_conquistas_destaques_obtida FOREIGN KEY (id_lista, codigo)
                REFERENCES conquistas_obtidas (id_lista, codigo) ON DELETE CASCADE
        );
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DROP TABLE conquistas_destaques;
        DROP TABLE conquistas_obtidas;
        DROP TABLE conquistas_itens;
        DROP TABLE conquistas;
        DROP TABLE conquistas_esquemas;
        """
    )
