--liquibase formatted sql

-- Interval timers: a user's named work/rest patterns, and the interval exercises that run one.
--
-- A timer describes one round (prepare once, then work and rest); how many rounds an exercise does
-- is its own set count. Unlike the plan rows, timers are not recreated by PUT /api/state, so an
-- exercise can point at one by its id.

--changeset emmaberdi:009-interval-timer splitStatements:true endDelimiter:; dbms:postgresql
--comment Named interval timers per user.
--preconditions onFail:MARK_RAN onError:HALT
--precondition-sql-check expectedResult:0 SELECT count(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'interval_timer'

CREATE TABLE interval_timer (
    id          BIGSERIAL   PRIMARY KEY,
    user_id     BIGINT      NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    name        VARCHAR(64) NOT NULL,
    prepare_sec INT         NOT NULL CONSTRAINT chk_interval_timer_prepare CHECK (prepare_sec BETWEEN 0 AND 3600),
    work_sec    INT         NOT NULL CONSTRAINT chk_interval_timer_work CHECK (work_sec BETWEEN 1 AND 3600),
    rest_sec    INT         NOT NULL CONSTRAINT chk_interval_timer_rest CHECK (rest_sec BETWEEN 0 AND 3600)
);

CREATE INDEX idx_interval_timer_user ON interval_timer(user_id);

--rollback DROP TABLE IF EXISTS interval_timer;

-- interval is one more value of the closed set on exercise.type. SET NULL on the timer link: the
-- exercise stays in the plan without a timer when its timer is deleted.

--changeset emmaberdi:009-exercise-interval splitStatements:true endDelimiter:; dbms:postgresql
--comment Allow interval as an exercise type and link interval exercises to a timer.
--preconditions onFail:MARK_RAN onError:HALT
--precondition-sql-check expectedResult:0 SELECT count(*) FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'exercise' AND column_name = 'timer_id'

ALTER TABLE exercise DROP CONSTRAINT chk_exercise_type;
ALTER TABLE exercise ADD CONSTRAINT chk_exercise_type
    CHECK (type IN ('kg','band','sek','bw','cm','m','min','kcal','interval'));

ALTER TABLE exercise ADD COLUMN timer_id BIGINT REFERENCES interval_timer(id) ON DELETE SET NULL;
CREATE INDEX idx_exercise_timer ON exercise(timer_id);

--rollback DROP INDEX IF EXISTS idx_exercise_timer;
--rollback ALTER TABLE exercise DROP COLUMN IF EXISTS timer_id;
--rollback ALTER TABLE exercise DROP CONSTRAINT chk_exercise_type;
--rollback ALTER TABLE exercise ADD CONSTRAINT chk_exercise_type CHECK (type IN ('kg','band','sek','bw','cm','m','min','kcal'));
