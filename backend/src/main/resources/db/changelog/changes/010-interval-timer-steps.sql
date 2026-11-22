--liquibase formatted sql

-- A timer's round becomes a list of intervals ("40 s work, 10 s rest, then 60 s work, 10 s rest")
-- instead of a single work/rest pair. The intervals are part of the timer and go with it, like
-- exercise_step goes with its exercise. Each existing timer keeps its pair as its first interval.

--changeset emmaberdi:010-interval-timer-steps splitStatements:true endDelimiter:; dbms:postgresql
--comment Several work/rest intervals per timer round.
--preconditions onFail:MARK_RAN onError:HALT
--precondition-sql-check expectedResult:0 SELECT count(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'interval_timer_step'

CREATE TABLE interval_timer_step (
    timer_id BIGINT NOT NULL REFERENCES interval_timer(id) ON DELETE CASCADE,
    position INT    NOT NULL CHECK (position >= 0),
    work_sec INT    NOT NULL CONSTRAINT chk_interval_timer_step_work CHECK (work_sec BETWEEN 1 AND 3600),
    rest_sec INT    NOT NULL CONSTRAINT chk_interval_timer_step_rest CHECK (rest_sec BETWEEN 0 AND 3600),
    PRIMARY KEY (timer_id, position)
);

INSERT INTO interval_timer_step (timer_id, position, work_sec, rest_sec)
SELECT id, 0, work_sec, rest_sec FROM interval_timer;

ALTER TABLE interval_timer DROP COLUMN work_sec;
ALTER TABLE interval_timer DROP COLUMN rest_sec;

--rollback ALTER TABLE interval_timer ADD COLUMN work_sec INT NOT NULL DEFAULT 20 CONSTRAINT chk_interval_timer_work CHECK (work_sec BETWEEN 1 AND 3600);
--rollback ALTER TABLE interval_timer ADD COLUMN rest_sec INT NOT NULL DEFAULT 10 CONSTRAINT chk_interval_timer_rest CHECK (rest_sec BETWEEN 0 AND 3600);
--rollback UPDATE interval_timer t SET work_sec = s.work_sec, rest_sec = s.rest_sec FROM interval_timer_step s WHERE s.timer_id = t.id AND s.position = 0;
--rollback DROP TABLE IF EXISTS interval_timer_step;
