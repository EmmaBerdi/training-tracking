--liquibase formatted sql

-- Pending changes of an account's email address. The new address is confirmed with a six-digit code
-- mailed to it, stored only as a BCrypt hash for the same reason as password_reset_token.
--
-- Only a user's newest request is ever checked, so asking again retires the earlier ones without
-- touching their rows; they stay as the record the per-hour request limit counts. new_email is not
-- unique: a pending request is no account, and uq_user_email_lower decides on confirm.

--changeset emmaberdi:014-email-change-request splitStatements:true endDelimiter:; dbms:postgresql
--comment Hashed one-time codes confirming a new email address for an account.
--preconditions onFail:MARK_RAN onError:HALT
--precondition-sql-check expectedResult:0 SELECT count(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'email_change_request'

CREATE TABLE email_change_request (
    id         BIGSERIAL    PRIMARY KEY,
    user_id    BIGINT       NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    new_email  VARCHAR(255) NOT NULL,
    code_hash  VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ  NOT NULL,
    used_at    TIMESTAMPTZ,
    attempts   INT          NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT chk_email_change_request_attempts CHECK (attempts >= 0)
);

CREATE INDEX idx_email_change_request_user ON email_change_request(user_id, created_at);

--rollback DROP TABLE IF EXISTS email_change_request;
