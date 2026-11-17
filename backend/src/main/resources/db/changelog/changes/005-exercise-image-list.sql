--liquibase formatted sql

-- An exercise can carry several setup photos — the start position, the band anchor, the end
-- position — in the order the user put them. The ordered list lives in its own table because a
-- column holds one reference only.
--
-- exercise_id rather than the client id: the rows belong to the exercise row and go with it when
-- PUT /api/state deletes and recreates the plan, exactly as exercise.image_id did. The image itself
-- survives that, as before, and is swept separately once nothing points at it.
--
-- exercise.image_id is copied over and then no longer written; every plan save recreates the
-- exercise rows without it, so it empties itself. Dropping it is left to a later changeset.

--changeset emmaberdi:005-exercise-image-list splitStatements:true endDelimiter:; dbms:postgresql
--comment Several ordered setup photos per exercise.
--preconditions onFail:MARK_RAN onError:HALT
--precondition-sql-check expectedResult:0 SELECT count(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'exercise_image_link'

CREATE TABLE exercise_image_link (
    exercise_id BIGINT   NOT NULL REFERENCES exercise(id) ON DELETE CASCADE,
    position    INT      NOT NULL CHECK (position >= 0),
    -- CASCADE, unlike image_id's SET NULL: a vanished image leaves no gap in the list behind it.
    image_id    UUID     NOT NULL REFERENCES exercise_image(id) ON DELETE CASCADE,
    PRIMARY KEY (exercise_id, position)
);

CREATE INDEX idx_exercise_image_link_image ON exercise_image_link(image_id);

INSERT INTO exercise_image_link (exercise_id, position, image_id)
SELECT id, 0, image_id FROM exercise WHERE image_id IS NOT NULL;

--rollback DROP TABLE IF EXISTS exercise_image_link;
