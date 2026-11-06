-- ============================================
-- MIGRAÇÃO INCREMENTAL 0006 - REFRESH TOKENS (ADR-0006)
-- Para bancos criados antes da tabela `refresh_tokens` existir no
-- `Banco DDL.sql`. Idempotente: rodar de novo não muda nada.
-- Aplicar no Docker: make db-migrate-refresh
-- A definição deve ser igual à do `Banco DDL.sql`.
-- ============================================

SET NAMES utf8mb4;
USE medialist_db;

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id_refresh VARCHAR(50) NOT NULL,
    token_hash CHAR(64) NOT NULL,
    id_usuario VARCHAR(50) NOT NULL,
    familia VARCHAR(50) NOT NULL,
    criado_em DATETIME NOT NULL,
    expira_em DATETIME NOT NULL,
    revogado BOOLEAN NOT NULL DEFAULT FALSE,
    substituido_por VARCHAR(50) NULL,
    PRIMARY KEY (id_refresh),
    UNIQUE KEY uk_token_hash (token_hash),
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (substituido_por) REFERENCES refresh_tokens(id_refresh) ON DELETE SET NULL,
    INDEX idx_familia (familia),
    INDEX idx_usuario (id_usuario)
) ENGINE=InnoDB;
