--liquibase formatted sql

-- Interval training: calories as a unit, a planned progression per exercise, and how hard a
-- workout felt.
--
-- kcal is one more value of the closed set on exercise.type. 001 declared that CHECK inline, so it
-- carries PostgreSQL's generated name; it is replaced by a named one. No IF EXISTS: if the name were
-- ever different, failing here beats leaving the old CHECK in place to refuse every kcal exercise.

--changeset emmaberdi:007-exercise-type-kcal splitStatements:true endDelimiter:; dbms:postgresql
--comment Allow kcal as an exercise type.
--preconditions onFail:MARK_RAN onError:HALT
--precondition-sql-check expectedResult:0 SELECT count(*) FROM information_schema.table_constraints WHERE table_schema = current_schema() AND table_name = 'exercise' AND constraint_name = 'chk_exercise_type'

ALTER TABLE exercise DROP CONSTRAINT exercise_type_check;
ALTER TABLE exercise ADD CONSTRAINT chk_exercise_type
    CHECK (type IN ('kg','band','sek','bw','cm','m','min','kcal'));

--rollback ALTER TABLE exercise DROP CONSTRAINT chk_exercise_type;
--rollback ALTER TABLE exercise ADD CONSTRAINT exercise_type_check CHECK (type IN ('kg','band','sek','bw','cm','m','min'));

-- The steps of a planned progression ("W1 3×4", "W2 3×5", "Taper 2×3"), in order, and which one
-- the exercise is at. A step may replace the plan's set count and rep text; NULL keeps the plan's.
-- Keyed by exercise_id like exercise_image_link: the steps are part of the exercise and go with it
-- when PUT /api/state deletes and recreates the plan. current_step is NULL without steps.

--changeset emmaberdi:007-exercise-step splitStatements:true endDelimiter:; dbms:postgresql
--comment Planned progression steps per exercise.
--preconditions onFail:MARK_RAN onError:HALT
--precondition-sql-check expectedResult:0 SELECT count(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'exercise_step'

CREATE TABLE exercise_step (
    exercise_id BIGINT       NOT NULL REFERENCES exercise(id) ON DELETE CASCADE,
    position    INT          NOT NULL CHECK (position >= 0),
    name        VARCHAR(32)  NOT NULL,
    sets        INT          CHECK (sets BETWEEN 0 AND 99),
    reps        VARCHAR(64),
    text        VARCHAR(500),
    PRIMARY KEY (exercise_id, position)
);

ALTER TABLE exercise
    ADD COLUMN current_step INT CONSTRAINT chk_exercise_current_step CHECK (current_step >= 0);

--rollback ALTER TABLE exercise DROP COLUMN IF EXISTS current_step;
--rollback DROP TABLE IF EXISTS exercise_step;

-- How hard one exercise felt in one workout, and the progression step it was done at. By the
-- exercise's client id rather than exercise.id: a rating says whether to move up a step, and the
-- step it names is plain text, so neither needs the plan row to still look the way it did.

--changeset emmaberdi:007-session-rating splitStatements:true endDelimiter:; dbms:postgresql
--comment Effort rating per exercise per logged workout.
--preconditions onFail:MARK_RAN onError:HALT
--precondition-sql-check expectedResult:0 SELECT count(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'session_rating'

CREATE TABLE session_rating (
    session_id         BIGINT      NOT NULL REFERENCES session(id) ON DELETE CASCADE,
    exercise_client_id VARCHAR(32) NOT NULL,
    effort             VARCHAR(8)  NOT NULL
        CONSTRAINT chk_session_rating_effort CHECK (effort IN ('leicht','mittel','schwer')),
    step               VARCHAR(32),
    PRIMARY KEY (session_id, exercise_client_id)
);

--rollback DROP TABLE IF EXISTS session_rating;
