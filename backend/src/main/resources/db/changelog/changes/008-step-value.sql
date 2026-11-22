--liquibase formatted sql

-- The target value of a progression step ("40" kg, "rot" for a band, "45" sek), in the exercise's
-- unit. It pre-fills the entry sheet ahead of the last logged value. Text like session_value.value,
-- because band values are colour names; NULL leaves the target to what was logged before.

--changeset emmaberdi:008-step-value splitStatements:true endDelimiter:; dbms:postgresql
--comment Optional target value per progression step.
--preconditions onFail:MARK_RAN onError:HALT
--precondition-sql-check expectedResult:0 SELECT count(*) FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'exercise_step' AND column_name = 'value'

ALTER TABLE exercise_step
    ADD COLUMN value VARCHAR(64);

--rollback ALTER TABLE exercise_step DROP COLUMN IF EXISTS value;
