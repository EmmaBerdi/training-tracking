--liquibase formatted sql

-- A workout plan belongs to one activity type: "Oberkörper" and "Unterkörper" are both Kraft
-- plans, and scheduling picks the type first, then one of that type's plans. The type replaces
-- slot (morgens/nachmittags), which predates real session times on the calendar and said nothing
-- the scheduled time does not say better.
--
-- ON DELETE RESTRICT like planned_session and recurring_rule: a custom type still carrying a plan
-- is refused with a readable conflict by SessionTypeService before the FK ever fires.

--changeset emmaberdi:003-day-session-type splitStatements:true endDelimiter:; dbms:postgresql
--comment Plans belong to a session type; drop the morning/afternoon slot.

ALTER TABLE day ADD COLUMN session_type_id BIGINT REFERENCES session_type(id) ON DELETE RESTRICT;

-- Existing plans take the type they are scheduled under most often, across one-off sessions,
-- fixed series and per-weekday/rotation series alike. Ties go to the lower type id.
UPDATE day d SET session_type_id = (
    SELECT ref.session_type_id
    FROM (
        SELECT user_id, day_key, session_type_id FROM planned_session
        UNION ALL
        SELECT user_id, day_key, session_type_id FROM recurring_rule
        UNION ALL
        SELECT r.user_id, rp.day_key, r.session_type_id
        FROM recurring_rule_plan rp JOIN recurring_rule r ON r.id = rp.rule_id
    ) ref
    WHERE ref.user_id = d.user_id AND ref.day_key = d.day_key
    GROUP BY ref.session_type_id
    ORDER BY count(*) DESC, ref.session_type_id
    LIMIT 1
);

-- A plan that was never scheduled is a strength plan in every account that has one today; the
-- user can change it from inside the plan.
UPDATE day SET session_type_id = (
    SELECT id FROM session_type
    WHERE user_id IS NULL
    ORDER BY lower(label) = 'kraft' DESC, id
    LIMIT 1
)
WHERE session_type_id IS NULL;

ALTER TABLE day ALTER COLUMN session_type_id SET NOT NULL;
CREATE INDEX idx_day_session_type ON day(session_type_id);

ALTER TABLE day DROP CONSTRAINT chk_day_slot;
ALTER TABLE day DROP COLUMN slot;

--rollback ALTER TABLE day ADD COLUMN slot VARCHAR(32) NOT NULL DEFAULT 'morgens';
--rollback ALTER TABLE day ALTER COLUMN slot DROP DEFAULT;
--rollback ALTER TABLE day ADD CONSTRAINT chk_day_slot CHECK (slot IN ('morgens', 'nachmittags'));
--rollback DROP INDEX IF EXISTS idx_day_session_type;
--rollback ALTER TABLE day DROP COLUMN session_type_id;
