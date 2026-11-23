--liquibase formatted sql

-- Accounts are created by an admin and claimed through a mailed one-time invitation, instead of by
-- public registration. An invited account has no password until the invitation is accepted, so
-- password_hash becomes optional for exactly that state.
--
-- Existing accounts become 'active' non-admins; ADMIN_EMAILS promotes the first admin on startup.

--changeset emmaberdi:013-user-admin-status splitStatements:true endDelimiter:; dbms:postgresql
--comment Admin flag, account status and last login per user.
--preconditions onFail:MARK_RAN onError:HALT
--precondition-sql-check expectedResult:0 SELECT count(*) FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'user' AND column_name = 'status'

ALTER TABLE "user"
    ADD COLUMN is_admin      BOOLEAN     NOT NULL DEFAULT false,
    ADD COLUMN status        VARCHAR(16) NOT NULL DEFAULT 'active',
    ADD COLUMN last_login_at TIMESTAMPTZ,
    ADD CONSTRAINT chk_user_status CHECK (status IN ('invited', 'active', 'deactivated')),
    ADD CONSTRAINT chk_user_password CHECK (status = 'invited' OR password_hash IS NOT NULL),
    ALTER COLUMN password_hash DROP NOT NULL;

--rollback ALTER TABLE "user" ALTER COLUMN password_hash SET NOT NULL, DROP CONSTRAINT IF EXISTS chk_user_password, DROP CONSTRAINT IF EXISTS chk_user_status, DROP COLUMN IF EXISTS last_login_at, DROP COLUMN IF EXISTS status, DROP COLUMN IF EXISTS is_admin;

-- The token is 32 random bytes, so a plain SHA-256 of it is enough (unlike the six-digit reset
-- codes, which need BCrypt). Only an account's newest invitation is honoured: resending retires the
-- earlier links without touching their rows.

--changeset emmaberdi:013-invitation splitStatements:true endDelimiter:; dbms:postgresql
--comment Hashed one-time invitation tokens for admin-created accounts.
--preconditions onFail:MARK_RAN onError:HALT
--precondition-sql-check expectedResult:0 SELECT count(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'invitation'

CREATE TABLE invitation (
    id         BIGSERIAL    PRIMARY KEY,
    user_id    BIGINT       NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ  NOT NULL,
    used_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_invitation_user ON invitation(user_id, created_at);

--rollback DROP TABLE IF EXISTS invitation;
