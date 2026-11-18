--liquibase formatted sql

-- The reps actually done in a logged set, next to its value. For kg and band exercises the value is
-- the load, and the plan only says what was intended ("6-8"); without the real count there is no
-- volume and no estimated max to chart. Optional: a set logged without reps keeps NULL, as does
-- everything logged before this column existed.
--
-- A column rather than a second value row, because it describes the same set and lives and dies with
-- it; SMALLINT with a CHECK because 0 reps is not a set and four-digit counts are typos.

--changeset emmaberdi:006-session-value-reps splitStatements:true endDelimiter:; dbms:postgresql
--comment Reps done per logged set, optional.
--preconditions onFail:MARK_RAN onError:HALT
--precondition-sql-check expectedResult:0 SELECT count(*) FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'session_value' AND column_name = 'reps'

ALTER TABLE session_value
    ADD COLUMN reps SMALLINT CONSTRAINT chk_session_value_reps CHECK (reps BETWEEN 1 AND 999);

--rollback ALTER TABLE session_value DROP COLUMN IF EXISTS reps;
