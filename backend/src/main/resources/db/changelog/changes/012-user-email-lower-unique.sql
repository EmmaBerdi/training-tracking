--liquibase formatted sql

-- Email addresses are one account regardless of casing: the app lower-cases what users type, and
-- this index stops "Emma@…" and "emma@…" from ever both existing. The original case-sensitive
-- UNIQUE constraint from 001 stays; it is implied by this one and harmless.
--
-- Fails, and halts startup, if case-duplicates already exist. Check before deploying:
--   SELECT lower(email), count(*), array_agg(id) FROM "user" GROUP BY 1 HAVING count(*) > 1;

--changeset emmaberdi:012-user-email-lower-unique splitStatements:true endDelimiter:; dbms:postgresql
--comment Case-insensitive uniqueness of user email.
--preconditions onFail:MARK_RAN onError:HALT
--precondition-sql-check expectedResult:0 SELECT count(*) FROM pg_indexes WHERE schemaname = current_schema() AND indexname = 'uq_user_email_lower'

CREATE UNIQUE INDEX uq_user_email_lower ON "user" (lower(email));

--rollback DROP INDEX IF EXISTS uq_user_email_lower;
