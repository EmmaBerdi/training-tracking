--liquibase formatted sql

-- An interval can say which exercise it is ("High Knees", "Battle Rope"), so the run screen shows
-- what to do instead of only "Arbeit". Optional: existing intervals stay unnamed.

--changeset emmaberdi:011-interval-timer-step-name splitStatements:true endDelimiter:; dbms:postgresql
--comment Optional exercise name per timer interval.
--preconditions onFail:MARK_RAN onError:HALT
--precondition-sql-check expectedResult:0 SELECT count(*) FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'interval_timer_step' AND column_name = 'name'

ALTER TABLE interval_timer_step ADD COLUMN name VARCHAR(64);

--rollback ALTER TABLE interval_timer_step DROP COLUMN IF EXISTS name;
