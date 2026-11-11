--liquibase formatted sql

-- One-time codes for "Passwort vergessen?". The code is mailed as six digits and stored only as a
-- BCrypt hash: a million possible values would fall to a fast hash straight out of a leaked dump.
--
-- Only a user's newest code is ever checked, so asking for a new one retires the old ones without
-- touching their rows. `attempts` caps guessing against that newest code; the rows themselves stay
-- around as the record the per-hour request limit counts.

--changeset emmaberdi:004-password-reset-token splitStatements:true endDelimiter:; dbms:postgresql
--comment Hashed one-time codes for resetting a forgotten password.
--preconditions onFail:MARK_RAN onError:HALT
--precondition-sql-check expectedResult:0 SELECT count(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'password_reset_token'

CREATE TABLE password_reset_token (
    id         BIGSERIAL    PRIMARY KEY,
    user_id    BIGINT       NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    code_hash  VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ  NOT NULL,
    used_at    TIMESTAMPTZ,
    attempts   INT          NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_password_reset_token_attempts CHECK (attempts >= 0)
);

CREATE INDEX idx_password_reset_token_user ON password_reset_token(user_id, created_at);
