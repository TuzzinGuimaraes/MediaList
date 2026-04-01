-- ============================================
-- SCHEMA COMPLETO - MEDIALIST
-- SISTEMA DE GERENCIAMENTO DE MIDIAS
-- COM IDs CUSTOMIZADOS (SEM AUTO_INCREMENT NAS ENTIDADES PRINCIPAIS)
-- ============================================

DROP DATABASE IF EXISTS medialist_db;
CREATE DATABASE medialist_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE medialist_db;

-- ============================================
-- TABELA DE SEQUÊNCIAS
-- ============================================

CREATE TABLE sequences (
    seq_name VARCHAR(50) PRIMARY KEY,
    seq_value BIGINT NOT NULL DEFAULT 0,
    prefix VARCHAR(10),
    description VARCHAR(200)
) ENGINE=InnoDB;

INSERT INTO sequences (seq_name, seq_value, prefix, description) VALUES
    ('usuario_seq', 1000, 'USR', 'Sequência para IDs de usuários'),
    ('anime_seq', 10000, 'ANM', 'Sequência para IDs de animes'),
    ('lista_seq', 1, 'LST', 'Sequência para lista de usuários'),
    ('avaliacao_seq', 1, 'AVL', 'Sequência para avaliações'),
    ('midia_seq', 20000, 'MID', 'Sequência para IDs de mídias (central)'),
    ('jogo_seq', 30000, 'JOG', 'Sequência para IDs de jogos'),
    ('manga_seq', 50000, 'MNG', 'Sequência para IDs de mangás');

-- ============================================
-- FUNCTIONS
-- ============================================

DELIMITER $$

CREATE FUNCTION get_next_sequence(p_seq_name VARCHAR(50))
RETURNS BIGINT
DETERMINISTIC
BEGIN
    DECLARE v_next_val BIGINT;

    UPDATE sequences
    SET seq_value = seq_value + 1
    WHERE seq_name = p_seq_name;

    SELECT seq_value INTO v_next_val
    FROM sequences
    WHERE seq_name = p_seq_name;

    RETURN v_next_val;
END$$

CREATE FUNCTION gerar_id_usuario()
RETURNS VARCHAR(50)
DETERMINISTIC
BEGIN
    DECLARE v_seq BIGINT;
    DECLARE v_data VARCHAR(8);

    SET v_seq = get_next_sequence('usuario_seq');
    SET v_data = DATE_FORMAT(CURDATE(), '%Y%m%d');

    RETURN CONCAT('USR-', v_data, '-', LPAD(v_seq, 5, '0'));
END$$

CREATE FUNCTION gerar_id_midia(p_tipo_midia VARCHAR(10))
RETURNS VARCHAR(50)
DETERMINISTIC
BEGIN
    DECLARE v_seq BIGINT;
    DECLARE v_ano VARCHAR(4);

    SET v_seq = get_next_sequence('midia_seq');
    SET v_ano = YEAR(CURDATE());

    RETURN CONCAT('MID-', UPPER(p_tipo_midia), '-', v_ano, '-', LPAD(v_seq, 5, '0'));
END$$

CREATE FUNCTION gerar_codigo_midia(p_titulo VARCHAR(200), p_tipo VARCHAR(5))
RETURNS VARCHAR(20)
DETERMINISTIC
BEGIN
    DECLARE v_codigo VARCHAR(20);
    DECLARE v_prefixo VARCHAR(8);
    DECLARE v_contador INT DEFAULT 1;
    DECLARE v_existe INT DEFAULT 0;
    DECLARE v_tentativas INT DEFAULT 0;

    SET v_prefixo = CONCAT(
        UPPER(p_tipo), '-',
        UPPER(LEFT(REPLACE(REPLACE(REPLACE(COALESCE(p_titulo, 'MIDIA'), ' ', ''), ':', ''), '-', ''), 3))
    );

    IF LENGTH(v_prefixo) < 6 THEN
        SET v_prefixo = RPAD(v_prefixo, 6, 'X');
    END IF;

    REPEAT
        SET v_codigo = CONCAT(v_prefixo, YEAR(CURDATE()), LPAD(v_contador, 3, '0'));
        SELECT COUNT(*) INTO v_existe FROM midias WHERE codigo_midia = v_codigo;
        IF v_existe > 0 THEN
            SET v_contador = v_contador + 1;
            SET v_tentativas = v_tentativas + 1;
        END IF;
    UNTIL v_existe = 0 OR v_tentativas >= 1000
    END REPEAT;

    IF v_tentativas >= 1000 THEN
        SET v_codigo = CONCAT(UPPER(p_tipo), YEAR(CURDATE()), LPAD(get_next_sequence('midia_seq'), 5, '0'));
    END IF;

    RETURN v_codigo;
END$$

CREATE FUNCTION gerar_uuid_customizado(p_prefixo VARCHAR(5))
RETURNS VARCHAR(50)
DETERMINISTIC
BEGIN
    DECLARE v_timestamp VARCHAR(20);
    DECLARE v_random VARCHAR(10);

    SET v_timestamp = UNIX_TIMESTAMP();
    SET v_random = FLOOR(RAND() * 9999999999);

    RETURN CONCAT(p_prefixo, '-', v_timestamp, '-', v_random);
END$$

DELIMITER ;

-- ============================================
-- LOOKUPS E TABELAS PRINCIPAIS
-- ============================================

CREATE TABLE tipo_midia (
    id_tipo TINYINT NOT NULL AUTO_INCREMENT,
    nome_tipo VARCHAR(20) NOT NULL UNIQUE,
    label VARCHAR(50) NOT NULL,
    PRIMARY KEY (id_tipo)
) ENGINE=InnoDB;

INSERT INTO tipo_midia (nome_tipo, label) VALUES
    ('anime', 'Anime'),
    ('manga', 'Mangá'),
    ('jogo', 'Jogo');

CREATE TABLE usuarios (
    id_usuario VARCHAR(50) NOT NULL,
    codigo_usuario VARCHAR(20) NOT NULL UNIQUE,
    nome_completo VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    data_nascimento DATE,
    foto_perfil VARCHAR(255),
    biografia TEXT,
    data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ultimo_acesso TIMESTAMP NULL,
    ativo BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (id_usuario),
    INDEX idx_codigo (codigo_usuario),
    INDEX idx_email (email),
    INDEX idx_ativo (ativo)
) ENGINE=InnoDB;

CREATE TABLE grupos_usuarios (
    id_grupo INT NOT NULL AUTO_INCREMENT,
    nome_grupo VARCHAR(50) NOT NULL UNIQUE,
    descricao TEXT,
    nivel_acesso ENUM('admin', 'moderador', 'usuario') NOT NULL,
    pode_criar BOOLEAN DEFAULT TRUE,
    pode_editar BOOLEAN DEFAULT TRUE,
    pode_deletar BOOLEAN DEFAULT FALSE,
    pode_moderar BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (id_grupo),
    INDEX idx_nivel_acesso (nivel_acesso)
) ENGINE=InnoDB AUTO_INCREMENT=1;

CREATE TABLE usuarios_grupos (
    id_usuario VARCHAR(50) NOT NULL,
    id_grupo INT NOT NULL,
    data_inclusao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_usuario, id_grupo),
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_grupo) REFERENCES grupos_usuarios(id_grupo) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE midias (
    id_midia VARCHAR(50) NOT NULL,
    codigo_midia VARCHAR(20) NOT NULL UNIQUE,
    id_tipo TINYINT NOT NULL,
    titulo_original VARCHAR(200) NOT NULL,
    titulo_ingles VARCHAR(200),
    titulo_portugues VARCHAR(200),
    sinopse TEXT,
    data_lancamento DATE,
    nota_media DECIMAL(3,2) DEFAULT 0.00,
    total_avaliacoes INT DEFAULT 0,
    poster_url VARCHAR(255),
    banner_url VARCHAR(255),
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_midia),
    FOREIGN KEY (id_tipo) REFERENCES tipo_midia(id_tipo),
    INDEX idx_tipo (id_tipo),
    INDEX idx_codigo (codigo_midia),
    INDEX idx_nota (nota_media),
    INDEX idx_titulo (titulo_portugues),
    FULLTEXT idx_busca (titulo_original, titulo_portugues, sinopse)
) ENGINE=InnoDB;

CREATE TABLE animes (
    id_midia VARCHAR(50) NOT NULL,
    status_anime ENUM('em_exibicao', 'finalizado', 'aguardando', 'cancelado') DEFAULT 'aguardando',
    numero_episodios INT,
    duracao_episodio INT COMMENT 'Duração em minutos',
    classificacao_etaria VARCHAR(10),
    trailer_url VARCHAR(255),
    estudio VARCHAR(100),
    fonte_original VARCHAR(100) COMMENT 'Manga, Light Novel, Original, etc',
    anilist_id INT NULL UNIQUE,
    PRIMARY KEY (id_midia),
    FOREIGN KEY (id_midia) REFERENCES midias(id_midia) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE jogos (
    id_midia VARCHAR(50) NOT NULL,
    desenvolvedor VARCHAR(100),
    publicadora VARCHAR(100),
    plataformas VARCHAR(200) COMMENT 'Ex: PC, PS5, Xbox, Switch',
    status_jogo ENUM('lancado', 'em_desenvolvimento', 'cancelado', 'remasterizado') DEFAULT 'lancado',
    modo_jogo ENUM('single', 'multi', 'ambos') DEFAULT 'ambos',
    classificacao VARCHAR(20),
    trailer_url VARCHAR(255),
    rawg_slug VARCHAR(200) NULL UNIQUE,
    PRIMARY KEY (id_midia),
    FOREIGN KEY (id_midia) REFERENCES midias(id_midia) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE mangas (
    id_midia VARCHAR(50) NOT NULL,
    status_manga ENUM('em_publicacao', 'finalizado', 'aguardando', 'cancelado', 'hiato') DEFAULT 'aguardando',
    numero_capitulos INT COMMENT 'Total de capítulos; NULL se em andamento',
    numero_volumes INT COMMENT 'Total de volumes; NULL se em andamento',
    autor VARCHAR(200) COMMENT 'Autor(es) do roteiro, separados por vírgula',
    artista VARCHAR(200) COMMENT 'Artista(s) do desenho',
    publicadora_original VARCHAR(100),
    revista VARCHAR(100),
    demografia ENUM('shounen', 'shoujo', 'seinen', 'josei', 'kodomomuke'),
    anilist_id INT NULL UNIQUE,
    PRIMARY KEY (id_midia),
    FOREIGN KEY (id_midia) REFERENCES midias(id_midia) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE generos (
    id_genero INT NOT NULL AUTO_INCREMENT,
    nome_genero VARCHAR(50) NOT NULL UNIQUE,
    descricao TEXT,
    aplicavel_a SET('anime', 'manga', 'jogo') DEFAULT 'anime,manga,jogo',
    PRIMARY KEY (id_genero),
    INDEX idx_nome (nome_genero)
) ENGINE=InnoDB AUTO_INCREMENT=1;

CREATE TABLE midias_generos (
    id_midia VARCHAR(50) NOT NULL,
    id_genero INT NOT NULL,
    PRIMARY KEY (id_midia, id_genero),
    FOREIGN KEY (id_midia) REFERENCES midias(id_midia) ON DELETE CASCADE,
    FOREIGN KEY (id_genero) REFERENCES generos(id_genero) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE lista_usuarios (
    id_lista VARCHAR(50) NOT NULL,
    codigo_lista VARCHAR(50) NOT NULL UNIQUE,
    id_usuario VARCHAR(50) NOT NULL,
    id_midia VARCHAR(50) NOT NULL,
    status_consumo ENUM(
        'assistindo', 'completo', 'planejado', 'pausado', 'abandonado',
        'lendo', 'lido',
        'jogando', 'zerado', 'platinado', 'na_fila'
    ) NOT NULL,
    progresso_atual INT DEFAULT 0,
    progresso_total INT,
    nota_usuario DECIMAL(3,2),
    favorito BOOLEAN DEFAULT FALSE,
    data_inicio DATE,
    data_conclusao DATE,
    comentario TEXT,
    total_rewatches INT DEFAULT 0,
    privado BOOLEAN DEFAULT FALSE,
    data_adicao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id_lista),
    UNIQUE KEY uk_usuario_midia (id_usuario, id_midia),
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_midia) REFERENCES midias(id_midia) ON DELETE CASCADE,
    INDEX idx_codigo (codigo_lista),
    INDEX idx_status (status_consumo),
    INDEX idx_favorito (favorito)
) ENGINE=InnoDB;

CREATE TABLE avaliacoes (
    id_avaliacao VARCHAR(50) NOT NULL,
    codigo_avaliacao VARCHAR(30) NOT NULL UNIQUE,
    id_usuario VARCHAR(50) NOT NULL,
    id_midia VARCHAR(50) NOT NULL,
    nota DECIMAL(3,2) NOT NULL CHECK (nota >= 0 AND nota <= 10),
    titulo_avaliacao VARCHAR(200),
    texto_avaliacao TEXT,
    data_avaliacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    data_edicao TIMESTAMP NULL,
    likes INT DEFAULT 0,
    dislikes INT DEFAULT 0,
    PRIMARY KEY (id_avaliacao),
    UNIQUE KEY uk_usuario_midia_avaliacao (id_usuario, id_midia),
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_midia) REFERENCES midias(id_midia) ON DELETE CASCADE,
    INDEX idx_codigo (codigo_avaliacao),
    INDEX idx_nota (nota),
    INDEX idx_data (data_avaliacao)
) ENGINE=InnoDB;

CREATE TABLE comentarios_avaliacoes (
    id_comentario INT NOT NULL AUTO_INCREMENT,
    id_avaliacao VARCHAR(50) NOT NULL,
    id_usuario VARCHAR(50) NOT NULL,
    texto_comentario TEXT NOT NULL,
    data_comentario TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_comentario),
    FOREIGN KEY (id_avaliacao) REFERENCES avaliacoes(id_avaliacao) ON DELETE CASCADE,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    INDEX idx_avaliacao (id_avaliacao)
) ENGINE=InnoDB;

-- ============================================
-- TRIGGERS
-- ============================================

DELIMITER $$

CREATE TRIGGER before_insert_usuario
BEFORE INSERT ON usuarios
FOR EACH ROW
BEGIN
    IF NEW.id_usuario IS NULL OR NEW.id_usuario = '' THEN
        SET NEW.id_usuario = gerar_id_usuario();
    END IF;

    IF NEW.codigo_usuario IS NULL OR NEW.codigo_usuario = '' THEN
        SET NEW.codigo_usuario = CONCAT('USR', LPAD(get_next_sequence('usuario_seq'), 8, '0'));
    END IF;
END$$

CREATE TRIGGER before_insert_midia
BEFORE INSERT ON midias
FOR EACH ROW
BEGIN
    DECLARE v_tipo_nome VARCHAR(20);
    DECLARE v_prefixo VARCHAR(5);

    SELECT nome_tipo INTO v_tipo_nome
    FROM tipo_midia
    WHERE id_tipo = NEW.id_tipo;

    SET v_prefixo = CASE v_tipo_nome
        WHEN 'anime' THEN 'ANM'
        WHEN 'manga' THEN 'MNG'
        WHEN 'jogo' THEN 'JOG'
        ELSE 'MID'
    END;

    IF NEW.id_midia IS NULL OR NEW.id_midia = '' THEN
        SET NEW.id_midia = gerar_id_midia(v_prefixo);
    END IF;

    IF NEW.codigo_midia IS NULL OR NEW.codigo_midia = '' THEN
        SET NEW.codigo_midia = gerar_codigo_midia(NEW.titulo_original, v_prefixo);
    END IF;
END$$

CREATE TRIGGER before_insert_midia_anime
BEFORE INSERT ON animes
FOR EACH ROW
BEGIN
    DECLARE v_existe INT;

    SELECT COUNT(*) INTO v_existe
    FROM midias
    WHERE id_midia = NEW.id_midia;

    IF v_existe = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Insira primeiro na tabela midias antes de inserir em animes.';
    END IF;
END$$

CREATE TRIGGER before_insert_lista
BEFORE INSERT ON lista_usuarios
FOR EACH ROW
BEGIN
    DECLARE v_seq BIGINT;

    IF NEW.id_lista IS NULL OR NEW.id_lista = '' THEN
        SET NEW.id_lista = gerar_uuid_customizado('LST');
    END IF;

    IF NEW.codigo_lista IS NULL OR NEW.codigo_lista = '' THEN
        SET v_seq = get_next_sequence('lista_seq');
        SET NEW.codigo_lista = CONCAT('LST', DATE_FORMAT(NOW(), '%Y%m%d'), '-', LPAD(v_seq, 6, '0'));
    END IF;

    IF NEW.progresso_total IS NULL THEN
        SET NEW.progresso_total = (
            SELECT CASE tm.nome_tipo
                WHEN 'anime' THEN a.numero_episodios
                WHEN 'manga' THEN ma.numero_capitulos
                ELSE NULL
            END
            FROM midias m
            JOIN tipo_midia tm ON m.id_tipo = tm.id_tipo
            LEFT JOIN animes a ON a.id_midia = m.id_midia
            LEFT JOIN mangas ma ON ma.id_midia = m.id_midia
            WHERE m.id_midia = NEW.id_midia
        );
    END IF;
END$$

CREATE TRIGGER validar_progresso_lista
BEFORE INSERT ON lista_usuarios
FOR EACH ROW
BEGIN
    DECLARE v_total INT;
    DECLARE v_tipo VARCHAR(20);

    SELECT tm.nome_tipo INTO v_tipo
    FROM midias m
    JOIN tipo_midia tm ON m.id_tipo = tm.id_tipo
    WHERE m.id_midia = NEW.id_midia;

    IF v_tipo = 'anime' THEN
        SELECT numero_episodios INTO v_total
        FROM animes
        WHERE id_midia = NEW.id_midia;

        IF v_total IS NOT NULL AND NEW.progresso_atual > v_total THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Episódios assistidos não pode ser maior que o total de episódios.';
        END IF;
    ELSEIF v_tipo = 'manga' THEN
        SELECT numero_capitulos INTO v_total
        FROM mangas
        WHERE id_midia = NEW.id_midia;

        IF v_total IS NOT NULL AND NEW.progresso_atual > v_total THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Capítulos lidos não pode ser maior que o total de capítulos.';
        END IF;
    END IF;
END$$

CREATE TRIGGER before_insert_avaliacao
BEFORE INSERT ON avaliacoes
FOR EACH ROW
BEGIN
    IF NEW.id_avaliacao IS NULL OR NEW.id_avaliacao = '' THEN
        SET NEW.id_avaliacao = gerar_uuid_customizado('AVL');
    END IF;

    IF NEW.codigo_avaliacao IS NULL OR NEW.codigo_avaliacao = '' THEN
        SET NEW.codigo_avaliacao = CONCAT('AVL', DATE_FORMAT(NOW(), '%Y%m%d'), '-', LPAD(get_next_sequence('avaliacao_seq'), 5, '0'));
    END IF;
END$$

CREATE TRIGGER atualizar_nota_media_insert
AFTER INSERT ON avaliacoes
FOR EACH ROW
BEGIN
    UPDATE midias
    SET nota_media = (
        SELECT ROUND(AVG(nota), 2)
        FROM avaliacoes
        WHERE id_midia = NEW.id_midia
    ),
    total_avaliacoes = (
        SELECT COUNT(*)
        FROM avaliacoes
        WHERE id_midia = NEW.id_midia
    )
    WHERE id_midia = NEW.id_midia;
END$$

CREATE TRIGGER atualizar_nota_media_update
AFTER UPDATE ON avaliacoes
FOR EACH ROW
BEGIN
    UPDATE midias
    SET nota_media = (
        SELECT ROUND(AVG(nota), 2)
        FROM avaliacoes
        WHERE id_midia = NEW.id_midia
    ),
    total_avaliacoes = (
        SELECT COUNT(*)
        FROM avaliacoes
        WHERE id_midia = NEW.id_midia
    )
    WHERE id_midia = NEW.id_midia;
END$$

CREATE TRIGGER atualizar_nota_media_delete
AFTER DELETE ON avaliacoes
FOR EACH ROW
BEGIN
    UPDATE midias
    SET nota_media = COALESCE((
        SELECT ROUND(AVG(nota), 2)
        FROM avaliacoes
        WHERE id_midia = OLD.id_midia
    ), 0.00),
    total_avaliacoes = (
        SELECT COUNT(*)
        FROM avaliacoes
        WHERE id_midia = OLD.id_midia
    )
    WHERE id_midia = OLD.id_midia;
END$$

CREATE TRIGGER registrar_ultimo_acesso
BEFORE UPDATE ON usuarios
FOR EACH ROW
BEGIN
    IF NEW.ativo = TRUE AND OLD.ativo = TRUE THEN
        SET NEW.ultimo_acesso = CURRENT_TIMESTAMP;
    END IF;
END$$

DELIMITER ;

-- ============================================
-- PROCEDURES
-- ============================================

DELIMITER $$

CREATE PROCEDURE adicionar_midia_lista(
    IN p_id_usuario VARCHAR(50),
    IN p_id_midia VARCHAR(50),
    IN p_status VARCHAR(20)
)
BEGIN
    DECLARE v_existe INT;

    SELECT COUNT(*) INTO v_existe
    FROM lista_usuarios
    WHERE id_usuario = p_id_usuario
      AND id_midia = p_id_midia;

    IF v_existe = 0 THEN
        INSERT INTO lista_usuarios (id_usuario, id_midia, status_consumo)
        VALUES (p_id_usuario, p_id_midia, p_status);

        SELECT 'Mídia adicionada com sucesso!' AS mensagem;
    ELSE
        SELECT 'Mídia já está na lista do usuário!' AS mensagem;
    END IF;
END$$

CREATE PROCEDURE atualizar_progresso_midia(
    IN p_id_lista VARCHAR(50),
    IN p_progresso_atual INT,
    IN p_novo_status VARCHAR(20)
)
BEGIN
    DECLARE v_total INT;
    DECLARE v_id_midia VARCHAR(50);
    DECLARE v_tipo VARCHAR(20);

    SELECT lu.id_midia, tm.nome_tipo
    INTO v_id_midia, v_tipo
    FROM lista_usuarios lu
    JOIN midias m ON lu.id_midia = m.id_midia
    JOIN tipo_midia tm ON m.id_tipo = tm.id_tipo
    WHERE lu.id_lista = p_id_lista;

    IF v_tipo = 'anime' THEN
        SELECT numero_episodios INTO v_total FROM animes WHERE id_midia = v_id_midia;
    ELSEIF v_tipo = 'manga' THEN
        SELECT numero_capitulos INTO v_total FROM mangas WHERE id_midia = v_id_midia;
    ELSE
        SET v_total = NULL;
    END IF;

    UPDATE lista_usuarios
    SET progresso_atual = p_progresso_atual,
        progresso_total = COALESCE(v_total, progresso_total),
        status_consumo = CASE
            WHEN v_total IS NOT NULL AND p_progresso_atual >= v_total THEN
                CASE v_tipo
                    WHEN 'anime' THEN 'completo'
                    WHEN 'manga' THEN 'lido'
                    ELSE p_novo_status
                END
            ELSE p_novo_status
        END,
        data_conclusao = CASE
            WHEN v_total IS NOT NULL AND p_progresso_atual >= v_total THEN CURDATE()
            ELSE data_conclusao
        END
    WHERE id_lista = p_id_lista;

    SELECT 'Progresso atualizado!' AS mensagem;
END$$

CREATE PROCEDURE obter_estatisticas_usuario(IN p_id_usuario VARCHAR(50))
BEGIN
    SELECT
        tm.nome_tipo AS tipo,
        tm.label AS label,
        COUNT(DISTINCT lu.id_midia) AS total_midias,
        SUM(CASE WHEN lu.status_consumo IN ('completo', 'lido', 'zerado', 'platinado') THEN 1 ELSE 0 END) AS concluidos,
        SUM(CASE WHEN lu.status_consumo IN ('assistindo', 'lendo', 'jogando') THEN 1 ELSE 0 END) AS em_andamento,
        SUM(COALESCE(lu.progresso_atual, 0)) AS progresso_total_consumido,
        ROUND(AVG(lu.nota_usuario), 2) AS nota_media,
        COUNT(DISTINCT CASE WHEN lu.favorito = TRUE THEN lu.id_midia END) AS favoritos
    FROM lista_usuarios lu
    JOIN midias m ON lu.id_midia = m.id_midia
    JOIN tipo_midia tm ON m.id_tipo = tm.id_tipo
    WHERE lu.id_usuario = p_id_usuario
    GROUP BY tm.id_tipo, tm.nome_tipo, tm.label
    ORDER BY tm.id_tipo;
END$$

CREATE PROCEDURE inserir_ou_atualizar_anime(
    IN p_titulo_original VARCHAR(200),
    IN p_titulo_ingles VARCHAR(200),
    IN p_titulo_portugues VARCHAR(200),
    IN p_sinopse TEXT,
    IN p_data_lancamento DATE,
    IN p_status_anime VARCHAR(20),
    IN p_numero_episodios INT,
    IN p_duracao_episodio INT,
    IN p_classificacao_etaria VARCHAR(10),
    IN p_nota_media DECIMAL(3,2),
    IN p_poster_url VARCHAR(255),
    IN p_banner_url VARCHAR(255),
    IN p_estudio VARCHAR(100),
    IN p_fonte_original VARCHAR(100),
    IN p_anilist_id INT,
    OUT p_id_midia VARCHAR(50),
    OUT p_ja_existia BOOLEAN
)
BEGIN
    DECLARE v_id_tipo TINYINT;
    DECLARE v_id_midia_encontrada VARCHAR(50);

    SELECT id_tipo INTO v_id_tipo FROM tipo_midia WHERE nome_tipo = 'anime';

    IF p_anilist_id IS NOT NULL THEN
        SELECT id_midia INTO v_id_midia_encontrada
        FROM animes
        WHERE anilist_id = p_anilist_id
        LIMIT 1;
    END IF;

    IF v_id_midia_encontrada IS NULL THEN
        SELECT id_midia INTO v_id_midia_encontrada
        FROM midias
        WHERE titulo_original = p_titulo_original
          AND id_tipo = v_id_tipo
        LIMIT 1;
    END IF;

    IF v_id_midia_encontrada IS NOT NULL THEN
        UPDATE midias
        SET titulo_ingles = COALESCE(p_titulo_ingles, titulo_ingles),
            titulo_portugues = COALESCE(p_titulo_portugues, titulo_portugues),
            sinopse = COALESCE(p_sinopse, sinopse),
            data_lancamento = COALESCE(p_data_lancamento, data_lancamento),
            nota_media = COALESCE(p_nota_media, nota_media),
            poster_url = COALESCE(p_poster_url, poster_url),
            banner_url = COALESCE(p_banner_url, banner_url)
        WHERE id_midia = v_id_midia_encontrada;

        UPDATE animes
        SET status_anime = COALESCE(p_status_anime, status_anime),
            numero_episodios = COALESCE(p_numero_episodios, numero_episodios),
            duracao_episodio = COALESCE(p_duracao_episodio, duracao_episodio),
            classificacao_etaria = COALESCE(p_classificacao_etaria, classificacao_etaria),
            estudio = COALESCE(p_estudio, estudio),
            fonte_original = COALESCE(p_fonte_original, fonte_original),
            anilist_id = COALESCE(p_anilist_id, anilist_id)
        WHERE id_midia = v_id_midia_encontrada;

        SET p_id_midia = v_id_midia_encontrada;
        SET p_ja_existia = TRUE;
    ELSE
        INSERT INTO midias (
            id_tipo, titulo_original, titulo_ingles, titulo_portugues, sinopse,
            data_lancamento, nota_media, poster_url, banner_url
        ) VALUES (
            v_id_tipo, p_titulo_original, p_titulo_ingles, p_titulo_portugues, p_sinopse,
            p_data_lancamento, COALESCE(p_nota_media, 0.00), p_poster_url, p_banner_url
        );

        SET p_id_midia = (
            SELECT id_midia
            FROM midias
            WHERE titulo_original = p_titulo_original
              AND id_tipo = v_id_tipo
            ORDER BY data_criacao DESC
            LIMIT 1
        );

        INSERT INTO animes (
            id_midia, status_anime, numero_episodios, duracao_episodio,
            classificacao_etaria, estudio, fonte_original, anilist_id
        ) VALUES (
            p_id_midia, COALESCE(p_status_anime, 'aguardando'), p_numero_episodios, p_duracao_episodio,
            p_classificacao_etaria, p_estudio, p_fonte_original, p_anilist_id
        );

        SET p_ja_existia = FALSE;
    END IF;
END$$

CREATE PROCEDURE inserir_ou_atualizar_manga(
    IN p_titulo_original VARCHAR(200),
    IN p_titulo_ingles VARCHAR(200),
    IN p_titulo_portugues VARCHAR(200),
    IN p_sinopse TEXT,
    IN p_data_lancamento DATE,
    IN p_nota_media DECIMAL(3,2),
    IN p_poster_url VARCHAR(255),
    IN p_banner_url VARCHAR(255),
    IN p_status_manga VARCHAR(20),
    IN p_numero_capitulos INT,
    IN p_numero_volumes INT,
    IN p_autor VARCHAR(200),
    IN p_artista VARCHAR(200),
    IN p_publicadora VARCHAR(100),
    IN p_revista VARCHAR(100),
    IN p_demografia VARCHAR(20),
    IN p_anilist_id INT,
    OUT p_id_midia VARCHAR(50),
    OUT p_ja_existia BOOLEAN
)
BEGIN
    DECLARE v_id_tipo TINYINT;
    DECLARE v_id_midia_encontrada VARCHAR(50);

    SELECT id_tipo INTO v_id_tipo FROM tipo_midia WHERE nome_tipo = 'manga';

    IF p_anilist_id IS NOT NULL THEN
        SELECT id_midia INTO v_id_midia_encontrada
        FROM mangas
        WHERE anilist_id = p_anilist_id
        LIMIT 1;
    END IF;

    IF v_id_midia_encontrada IS NULL THEN
        SELECT id_midia INTO v_id_midia_encontrada
        FROM midias
        WHERE titulo_original = p_titulo_original
          AND id_tipo = v_id_tipo
        LIMIT 1;
    END IF;

    IF v_id_midia_encontrada IS NOT NULL THEN
        UPDATE midias
        SET titulo_ingles = COALESCE(p_titulo_ingles, titulo_ingles),
            titulo_portugues = COALESCE(p_titulo_portugues, titulo_portugues),
            sinopse = COALESCE(p_sinopse, sinopse),
            data_lancamento = COALESCE(p_data_lancamento, data_lancamento),
            nota_media = COALESCE(p_nota_media, nota_media),
            poster_url = COALESCE(p_poster_url, poster_url),
            banner_url = COALESCE(p_banner_url, banner_url)
        WHERE id_midia = v_id_midia_encontrada;

        UPDATE mangas
        SET status_manga = COALESCE(p_status_manga, status_manga),
            numero_capitulos = COALESCE(p_numero_capitulos, numero_capitulos),
            numero_volumes = COALESCE(p_numero_volumes, numero_volumes),
            autor = COALESCE(p_autor, autor),
            artista = COALESCE(p_artista, artista),
            publicadora_original = COALESCE(p_publicadora, publicadora_original),
            revista = COALESCE(p_revista, revista),
            demografia = COALESCE(p_demografia, demografia),
            anilist_id = COALESCE(p_anilist_id, anilist_id)
        WHERE id_midia = v_id_midia_encontrada;

        SET p_id_midia = v_id_midia_encontrada;
        SET p_ja_existia = TRUE;
    ELSE
        INSERT INTO midias (
            id_tipo, titulo_original, titulo_ingles, titulo_portugues, sinopse,
            data_lancamento, nota_media, poster_url, banner_url
        ) VALUES (
            v_id_tipo, p_titulo_original, p_titulo_ingles, p_titulo_portugues, p_sinopse,
            p_data_lancamento, COALESCE(p_nota_media, 0.00), p_poster_url, p_banner_url
        );

        SET p_id_midia = (
            SELECT id_midia
            FROM midias
            WHERE titulo_original = p_titulo_original
              AND id_tipo = v_id_tipo
            ORDER BY data_criacao DESC
            LIMIT 1
        );

        INSERT INTO mangas (
            id_midia, status_manga, numero_capitulos, numero_volumes,
            autor, artista, publicadora_original, revista, demografia, anilist_id
        ) VALUES (
            p_id_midia, COALESCE(p_status_manga, 'aguardando'), p_numero_capitulos, p_numero_volumes,
            p_autor, p_artista, p_publicadora, p_revista, p_demografia, p_anilist_id
        );

        SET p_ja_existia = FALSE;
    END IF;
END$$

CREATE PROCEDURE inserir_ou_atualizar_jogo(
    IN p_titulo_original VARCHAR(200),
    IN p_titulo_portugues VARCHAR(200),
    IN p_sinopse TEXT,
    IN p_data_lancamento DATE,
    IN p_nota_media DECIMAL(3,2),
    IN p_poster_url VARCHAR(255),
    IN p_banner_url VARCHAR(255),
    IN p_desenvolvedor VARCHAR(100),
    IN p_publicadora VARCHAR(100),
    IN p_plataformas VARCHAR(200),
    IN p_status_jogo VARCHAR(20),
    IN p_modo_jogo VARCHAR(10),
    IN p_classificacao VARCHAR(20),
    IN p_trailer_url VARCHAR(255),
    IN p_rawg_slug VARCHAR(200),
    OUT p_id_midia VARCHAR(50),
    OUT p_ja_existia BOOLEAN
)
BEGIN
    DECLARE v_id_tipo TINYINT;
    DECLARE v_id_midia_encontrada VARCHAR(50);

    SELECT id_tipo INTO v_id_tipo FROM tipo_midia WHERE nome_tipo = 'jogo';

    IF p_rawg_slug IS NOT NULL AND p_rawg_slug <> '' THEN
        SELECT id_midia INTO v_id_midia_encontrada
        FROM jogos
        WHERE rawg_slug = p_rawg_slug
        LIMIT 1;
    END IF;

    IF v_id_midia_encontrada IS NULL THEN
        SELECT id_midia INTO v_id_midia_encontrada
        FROM midias
        WHERE titulo_original = p_titulo_original
          AND id_tipo = v_id_tipo
        LIMIT 1;
    END IF;

    IF v_id_midia_encontrada IS NOT NULL THEN
        UPDATE midias
        SET titulo_portugues = COALESCE(p_titulo_portugues, titulo_portugues),
            sinopse = COALESCE(p_sinopse, sinopse),
            data_lancamento = COALESCE(p_data_lancamento, data_lancamento),
            nota_media = COALESCE(p_nota_media, nota_media),
            poster_url = COALESCE(p_poster_url, poster_url),
            banner_url = COALESCE(p_banner_url, banner_url)
        WHERE id_midia = v_id_midia_encontrada;

        UPDATE jogos
        SET desenvolvedor = COALESCE(p_desenvolvedor, desenvolvedor),
            publicadora = COALESCE(p_publicadora, publicadora),
            plataformas = COALESCE(p_plataformas, plataformas),
            status_jogo = COALESCE(p_status_jogo, status_jogo),
            modo_jogo = COALESCE(p_modo_jogo, modo_jogo),
            classificacao = COALESCE(p_classificacao, classificacao),
            trailer_url = COALESCE(p_trailer_url, trailer_url),
            rawg_slug = COALESCE(p_rawg_slug, rawg_slug)
        WHERE id_midia = v_id_midia_encontrada;

        SET p_id_midia = v_id_midia_encontrada;
        SET p_ja_existia = TRUE;
    ELSE
        INSERT INTO midias (
            id_tipo, titulo_original, titulo_portugues, sinopse, data_lancamento,
            nota_media, poster_url, banner_url
        ) VALUES (
            v_id_tipo, p_titulo_original, COALESCE(p_titulo_portugues, p_titulo_original), p_sinopse, p_data_lancamento,
            COALESCE(p_nota_media, 0.00), p_poster_url, p_banner_url
        );

        SET p_id_midia = (
            SELECT id_midia
            FROM midias
            WHERE titulo_original = p_titulo_original
              AND id_tipo = v_id_tipo
            ORDER BY data_criacao DESC
            LIMIT 1
        );

        INSERT INTO jogos (
            id_midia, desenvolvedor, publicadora, plataformas,
            status_jogo, modo_jogo, classificacao, trailer_url, rawg_slug
        ) VALUES (
            p_id_midia, p_desenvolvedor, p_publicadora, p_plataformas,
            COALESCE(p_status_jogo, 'lancado'), COALESCE(p_modo_jogo, 'ambos'),
            p_classificacao, p_trailer_url, p_rawg_slug
        );

        SET p_ja_existia = FALSE;
    END IF;
END$$

DELIMITER ;

-- ============================================
-- VIEWS
-- ============================================

CREATE VIEW vw_midias_populares AS
SELECT
    m.id_midia,
    m.codigo_midia,
    tm.nome_tipo AS tipo,
    tm.label AS tipo_label,
    m.titulo_original,
    m.titulo_portugues,
    m.poster_url,
    m.nota_media,
    COUNT(DISTINCT lu.id_usuario) AS total_usuarios,
    SUM(CASE WHEN lu.status_consumo IN ('completo', 'lido', 'zerado', 'platinado') THEN 1 ELSE 0 END) AS usuarios_concluiram,
    SUM(CASE WHEN lu.favorito = TRUE THEN 1 ELSE 0 END) AS total_favoritos,
    GROUP_CONCAT(DISTINCT g.nome_genero ORDER BY g.nome_genero SEPARATOR ', ') AS generos
FROM midias m
JOIN tipo_midia tm ON m.id_tipo = tm.id_tipo
LEFT JOIN lista_usuarios lu ON m.id_midia = lu.id_midia
LEFT JOIN midias_generos mg ON m.id_midia = mg.id_midia
LEFT JOIN generos g ON mg.id_genero = g.id_genero
GROUP BY m.id_midia, m.codigo_midia, tm.nome_tipo, tm.label, m.titulo_original, m.titulo_portugues, m.poster_url, m.nota_media
HAVING total_usuarios > 0
ORDER BY total_usuarios DESC, m.nota_media DESC;

CREATE VIEW vw_animes_temporada_atual AS
SELECT
    m.id_midia,
    m.codigo_midia,
    m.titulo_original,
    m.titulo_portugues,
    m.sinopse,
    m.poster_url,
    m.banner_url,
    m.nota_media,
    a.status_anime,
    m.data_lancamento,
    GROUP_CONCAT(DISTINCT g.nome_genero ORDER BY g.nome_genero SEPARATOR ', ') AS generos,
    COUNT(DISTINCT lu.id_usuario) AS total_usuarios
FROM midias m
JOIN animes a ON m.id_midia = a.id_midia
LEFT JOIN midias_generos mg ON m.id_midia = mg.id_midia
LEFT JOIN generos g ON mg.id_genero = g.id_genero
LEFT JOIN lista_usuarios lu ON m.id_midia = lu.id_midia
WHERE a.status_anime = 'em_exibicao'
  AND QUARTER(m.data_lancamento) = QUARTER(CURDATE())
  AND YEAR(m.data_lancamento) = YEAR(CURDATE())
GROUP BY m.id_midia, m.codigo_midia, m.titulo_original, m.titulo_portugues, m.sinopse,
         m.poster_url, m.banner_url, m.nota_media, a.status_anime, m.data_lancamento
ORDER BY m.nota_media DESC, total_usuarios DESC;

CREATE VIEW vw_perfil_usuario AS
SELECT
    u.id_usuario,
    u.codigo_usuario,
    u.nome_completo,
    u.email,
    u.foto_perfil,
    u.biografia,
    u.data_cadastro,
    COUNT(DISTINCT lu.id_midia) AS total_midias,
    COUNT(DISTINCT CASE WHEN tm.nome_tipo = 'anime' THEN lu.id_midia END) AS total_animes,
    COUNT(DISTINCT CASE WHEN tm.nome_tipo = 'manga' THEN lu.id_midia END) AS total_mangas,
    COUNT(DISTINCT CASE WHEN tm.nome_tipo = 'jogo' THEN lu.id_midia END) AS total_jogos,
    ROUND(AVG(lu.nota_usuario), 2) AS nota_media_usuario,
    COUNT(DISTINCT CASE WHEN lu.favorito = TRUE THEN lu.id_midia END) AS total_favoritos,
    GROUP_CONCAT(DISTINCT gu.nome_grupo SEPARATOR ', ') AS grupos
FROM usuarios u
LEFT JOIN lista_usuarios lu ON u.id_usuario = lu.id_usuario
LEFT JOIN midias m ON lu.id_midia = m.id_midia
LEFT JOIN tipo_midia tm ON m.id_tipo = tm.id_tipo
LEFT JOIN usuarios_grupos ug ON u.id_usuario = ug.id_usuario
LEFT JOIN grupos_usuarios gu ON ug.id_grupo = gu.id_grupo
GROUP BY u.id_usuario, u.codigo_usuario, u.nome_completo, u.email, u.foto_perfil, u.biografia, u.data_cadastro;

-- ============================================
-- ÍNDICES ADICIONAIS
-- ============================================

CREATE INDEX idx_lista_status_usuario ON lista_usuarios(id_usuario, status_consumo);
CREATE INDEX idx_avaliacoes_midia_nota ON avaliacoes(id_midia, nota);
CREATE INDEX idx_midias_data_lancamento ON midias(data_lancamento);
CREATE INDEX idx_jogos_plataformas ON jogos(plataformas);
CREATE INDEX idx_mangas_autor ON mangas(autor);

-- ============================================
-- DADOS INICIAIS
-- ============================================

INSERT INTO grupos_usuarios (nome_grupo, descricao, nivel_acesso, pode_criar, pode_editar, pode_deletar, pode_moderar) VALUES
    ('Administradores', 'Acesso total ao sistema', 'admin', TRUE, TRUE, TRUE, TRUE),
    ('Moderadores', 'Pode moderar conteúdo', 'moderador', TRUE, TRUE, FALSE, TRUE),
    ('Usuários', 'Usuários regulares', 'usuario', FALSE, FALSE, FALSE, FALSE);

INSERT INTO generos (nome_genero, descricao, aplicavel_a) VALUES
    ('Ação', 'Cenas de ação e combate', 'anime,manga,jogo'),
    ('Aventura', 'Jornadas e explorações', 'anime,manga,jogo'),
    ('Comédia', 'Obras humorísticas', 'anime,manga,jogo'),
    ('Drama', 'Histórias dramáticas', 'anime,manga,jogo'),
    ('Fantasia', 'Elementos fantásticos e mágicos', 'anime,manga,jogo'),
    ('Ficção Científica', 'Tecnologia e futurismo', 'anime,manga,jogo'),
    ('Romance', 'Histórias de amor', 'anime,manga'),
    ('Slice of Life', 'Cotidiano e vida real', 'anime,manga'),
    ('Sobrenatural', 'Elementos sobrenaturais', 'anime,manga'),
    ('Mistério', 'Histórias de mistério e suspense', 'anime,manga,jogo'),
    ('Terror', 'Horror e suspense', 'anime,manga,jogo'),
    ('Esportes', 'Competições esportivas', 'anime,manga,jogo'),
    ('Mecha', 'Robôs gigantes', 'anime,manga'),
    ('Shounen', 'Público jovem masculino', 'anime,manga'),
    ('Shoujo', 'Público jovem feminino', 'anime,manga'),
    ('Seinen', 'Público adulto masculino', 'anime,manga'),
    ('Josei', 'Público adulto feminino', 'anime,manga'),
    ('Isekai', 'Transportado para outro mundo', 'anime,manga'),
    ('Escola', 'Ambiente escolar', 'anime,manga'),
    ('Música', 'Obras centradas em música', 'anime,manga'),
    ('RPG', 'Role-Playing Game', 'jogo'),
    ('FPS', 'First-Person Shooter', 'jogo'),
    ('Estratégia', 'Jogos de estratégia em tempo real ou turnos', 'jogo'),
    ('Plataforma', 'Jogos de plataforma 2D/3D', 'jogo'),
    ('Battle Royale', 'Últimos a sobreviver vencem', 'jogo'),
    ('Simulação', 'Simuladores de vida, corrida e afins', 'jogo'),
    ('Puzzle', 'Quebra-cabeças e raciocínio', 'jogo'),
    ('Survival', 'Sobrevivência em mundo aberto', 'jogo'),
    ('MOBA', 'Multiplayer Online Battle Arena', 'jogo');

-- ============================================
-- SCRIPT DE MIGRAÇÃO (REFERÊNCIA)
-- ============================================
-- START TRANSACTION;
-- RENAME TABLE animes TO animes_old;
-- RENAME TABLE animes_generos TO animes_generos_old;
-- INSERT INTO midias (
--   id_midia, codigo_midia, id_tipo, titulo_original, titulo_ingles, titulo_portugues,
--   sinopse, data_lancamento, nota_media, total_avaliacoes, poster_url, banner_url,
--   data_criacao, data_atualizacao
-- )
-- SELECT
--   id_anime, codigo_anime, (SELECT id_tipo FROM tipo_midia WHERE nome_tipo = 'anime'),
--   titulo_original, titulo_ingles, titulo_portugues, sinopse, data_lancamento,
--   nota_media, total_avaliacoes, poster_url, banner_url, data_criacao, data_atualizacao
-- FROM animes_old;
-- INSERT INTO animes (
--   id_midia, status_anime, numero_episodios, duracao_episodio,
--   classificacao_etaria, trailer_url, estudio, fonte_original
-- )
-- SELECT
--   id_anime, status_anime, numero_episodios, duracao_episodio,
--   classificacao_etaria, trailer_url, estudio, fonte_original
-- FROM animes_old;
-- INSERT INTO midias_generos (id_midia, id_genero)
-- SELECT id_anime, id_genero FROM animes_generos_old;
-- COMMIT;

-- ============================================
-- USUÁRIO DE APLICAÇÃO
-- ============================================

CREATE USER IF NOT EXISTS 'media_app_user'@'%' IDENTIFIED BY 'MediaList@2025!Secure';
GRANT ALL PRIVILEGES ON medialist_db.* TO 'media_app_user'@'%';
FLUSH PRIVILEGES;
