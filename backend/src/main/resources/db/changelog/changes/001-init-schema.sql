--liquibase formatted sql

-- The whole schema in one piece: the flattened end state of what used to be eight incremental
-- Flyway migrations (V1-V8), rewritten as the shape the application actually validates against
-- today. Nothing here is a correction of anything above it — every table is written once, already
-- correct, and the comments keep the reasoning that the superseded migrations carried.
--
-- Table and column names are singular throughout: one row is one user, one day, one exercise, so
-- the name of the table is the name of the thing a row holds. "user" is a reserved word in
-- PostgreSQL and therefore always double-quoted; it is the one table that cannot be written bare.
--
-- The file is plain SQL apart from the Liquibase marker comments, so it also runs standalone:
--   psql -d training_tracking -f 001-init-schema.sql
-- against an empty database gives the same result as letting the backend apply it on startup.
--
-- The precondition makes re-running against an already-created schema safe: if "user" exists, the
-- schema is assumed to be there and the changeset is marked as run instead of executed. A fresh
-- database has no "user" table, so it runs for real.

--changeset emmaberdi:001-init-schema splitStatements:true endDelimiter:; dbms:postgresql
--comment Consolidated baseline schema: accounts, training plan, logged workouts, calendar.
--preconditions onFail:MARK_RAN onError:HALT
--precondition-sql-check expectedResult:0 SELECT count(*) FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = 'user'

-- ---------------------------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------------------------

CREATE TABLE "user" (
    id            BIGSERIAL    PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name  VARCHAR(255),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Refresh tokens are stored hashed so a DB leak alone doesn't hand out usable tokens,
-- and logout/rotation can actually revoke a specific token.
CREATE TABLE refresh_token (
    id         BIGSERIAL    PRIMARY KEY,
    user_id    BIGINT       NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ  NOT NULL,
    revoked    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_token_hash ON refresh_token(token_hash);
CREATE INDEX idx_refresh_token_user ON refresh_token(user_id);

-- ---------------------------------------------------------------------------------------------
-- Training plan: day -> block -> exercise, plus the per-user warmup list
-- ---------------------------------------------------------------------------------------------

-- day_key is the client-facing id of a plan and is what everything outside this table references:
-- PUT /api/state deletes and recreates every day row on each plan save, so the surrogate id is not
-- a stable identity across edits, but (user_id, day_key) is. slot is a closed set on the client.
CREATE TABLE day (
    id          BIGSERIAL    PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    day_key     VARCHAR(16)  NOT NULL,
    short_label VARCHAR(32)  NOT NULL,
    slot        VARCHAR(32)  NOT NULL,
    title       VARCHAR(255) NOT NULL,
    position    INT          NOT NULL,
    UNIQUE (user_id, day_key),
    CONSTRAINT chk_day_slot CHECK (slot IN ('morgens', 'nachmittags'))
);

CREATE INDEX idx_day_user ON day(user_id);

-- Every block belongs to exactly one day. (A block shared across all of a user's days existed only
-- in the seeded plan that predated user accounts; nothing in the UI ever created or edited one.)
-- kind is a closed set on the client, mirrored here like exercise.type and session_value.side.
CREATE TABLE block (
    id       BIGSERIAL    PRIMARY KEY,
    user_id  BIGINT       NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    day_id   BIGINT       NOT NULL REFERENCES day(id) ON DELETE CASCADE,
    kind     VARCHAR(32)  NOT NULL,
    name     VARCHAR(255) NOT NULL,
    position INT          NOT NULL,
    CONSTRAINT chk_block_kind
        CHECK (kind IN ('huefte', 'skill', 'kraft', 'explosiv', 'core', 'ausdauer'))
);

CREATE INDEX idx_block_day  ON block(day_id);
CREATE INDEX idx_block_user ON block(user_id);

-- client_id is the client-generated uid, unique only within its block; the surrogate id is the
-- real cross-table reference (session_value points at it).
CREATE TABLE exercise (
    id          BIGSERIAL    PRIMARY KEY,
    client_id   VARCHAR(32)  NOT NULL,
    block_id    BIGINT       NOT NULL REFERENCES block(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    type        VARCHAR(16)  NOT NULL CHECK (type IN ('kg','band','sek','bw','cm','m','min')),
    uni         BOOLEAN      NOT NULL DEFAULT FALSE,
    sets        INT,
    sets_l      INT,
    sets_r      INT,
    reps        VARCHAR(64)  NOT NULL,
    note        TEXT,
    description TEXT,
    position    INT          NOT NULL,
    UNIQUE (block_id, client_id)
);

CREATE INDEX idx_exercise_block ON exercise(block_id);

-- The warmup list is a single ordered list per user, shared by every one of that user's days.
CREATE TABLE warmup_item (
    id       BIGSERIAL PRIMARY KEY,
    user_id  BIGINT    NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    position INT       NOT NULL,
    text     TEXT      NOT NULL,
    UNIQUE (user_id, position)
);

-- ---------------------------------------------------------------------------------------------
-- Logged workouts
-- ---------------------------------------------------------------------------------------------

-- One logged workout instance per user + calendar date + plan. day_key rather than a FK to day:
-- besides surviving the delete-and-recreate of PUT /api/state, it lets logged history outlive the
-- plan it was recorded against, so "delete all plans" doesn't have to take the history with it.
CREATE TABLE session (
    id           BIGSERIAL   PRIMARY KEY,
    user_id      BIGINT      NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    session_date DATE        NOT NULL,
    day_key      VARCHAR(16) NOT NULL,
    CONSTRAINT uq_session_user_date_day UNIQUE (user_id, session_date, day_key)
);

CREATE INDEX idx_session_date ON session(session_date);
CREATE INDEX idx_session_user ON session(user_id);

-- Checked-off warmup items for a session, addressed by position in warmup_item.
-- Row presence means checked; there is no "unchecked" state to record.
CREATE TABLE session_warmup (
    session_id BIGINT NOT NULL REFERENCES session(id) ON DELETE CASCADE,
    position   INT    NOT NULL,
    PRIMARY KEY (session_id, position)
);

-- Logged value for one set of one exercise (side is B = both/bilateral, L = left, R = right).
CREATE TABLE session_value (
    session_id  BIGINT      NOT NULL REFERENCES session(id) ON DELETE CASCADE,
    exercise_id BIGINT      NOT NULL REFERENCES exercise(id) ON DELETE CASCADE,
    side        VARCHAR(1)  NOT NULL CHECK (side IN ('B','L','R')),
    set_index   INT         NOT NULL,
    value       VARCHAR(64) NOT NULL,
    PRIMARY KEY (session_id, exercise_id, side, set_index)
);

-- ---------------------------------------------------------------------------------------------
-- Calendar: activity types, repeating series, planned sessions
-- ---------------------------------------------------------------------------------------------

-- A curated, user-extensible list of activity kinds.
-- user_id IS NULL -> seeded global default, visible to every user, owned by no one.
-- user_id = X     -> custom type created by user X, visible only to them.
CREATE TABLE session_type (
    id         BIGSERIAL   PRIMARY KEY,
    user_id    BIGINT      REFERENCES "user"(id) ON DELETE CASCADE,
    label      VARCHAR(64) NOT NULL,
    color      VARCHAR(16),
    icon       VARCHAR(32),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Label must be unique within its scope: one global default per label, one per-user custom label per user.
CREATE UNIQUE INDEX uq_session_type_global_label ON session_type (lower(label)) WHERE user_id IS NULL;
CREATE UNIQUE INDEX uq_session_type_user_label   ON session_type (user_id, lower(label)) WHERE user_id IS NOT NULL;

-- German labels, matching the UI. The insertion order is deliberate: it reproduces the ids a
-- database migrated step by step ended up with, so a fresh database and an old one agree on which
-- id means which activity.
INSERT INTO session_type (user_id, label, color, icon) VALUES
    (NULL, 'Laufen',          '#f97316', 'jogging'),
    (NULL, 'Kraft',           '#ef4444', 'strength'),
    (NULL, 'Bouldern',        '#8b5cf6', 'bouldering'),
    (NULL, 'Radfahren',       '#22c55e', 'cycling'),
    (NULL, 'Schwimmen',       '#0ea5e9', 'swimming'),
    (NULL, 'Yoga / Mobility', '#ec4899', 'yoga'),
    (NULL, 'Ruhetag',         '#94a3b8', 'rest'),
    (NULL, 'Sonstiges',       '#64748b', 'other');

-- A repeating training slot. `pattern` answers *when* the series generates a date:
--   'weekly'   -> on the weekdays in the `weekdays` bitmask (Mo=1, Di=2, Mi=4, Do=8, Fr=16, Sa=32, So=64)
--   'interval' -> every `interval_days` days, counted from start_date
-- `plan_mode` answers *which* plan lands on that date:
--   'fixed'    -> recurring_rule.day_key, one plan for the whole series
--   'weekday'  -> recurring_rule_plan keyed by weekday index (0=Mo .. 6=So); a scheduled weekday
--                 with no row generates its occurrence without a plan
--   'rotation' -> recurring_rule_plan keyed by cycle position 0..n-1, advancing one step per
--                 generated date, so a 3-plan cycle brings each plan back every third session
-- series_id names the chain a rule belongs to: the id of the rule the series started as. Every
-- "alle kuenftigen Termine" edit splits a series into two rule rows, and without the chain an edit
-- on an earlier half overlapped its own successors. NULL means the rule heads its own chain. No FK
-- on purpose: the head row can legitimately be deleted while later halves live on.
CREATE TABLE recurring_rule (
    id              BIGSERIAL   PRIMARY KEY,
    user_id         BIGINT      NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    series_id       BIGINT,
    session_type_id BIGINT      NOT NULL REFERENCES session_type(id) ON DELETE RESTRICT,
    day_key         VARCHAR(16),
    plan_mode       VARCHAR(16) NOT NULL DEFAULT 'fixed'
                        CHECK (plan_mode IN ('fixed', 'weekday', 'rotation')),
    -- Which cycle step the rule's own start_date sits on. A split series starts mid-cycle; without
    -- this the new half would restart at the first plan of the rotation.
    rotation_offset SMALLINT    NOT NULL DEFAULT 0 CHECK (rotation_offset >= 0),
    scheduled_time  TIME,
    notes           TEXT,
    pattern         VARCHAR(16) NOT NULL CHECK (pattern IN ('weekly', 'interval')),
    weekdays        SMALLINT    CHECK (weekdays BETWEEN 1 AND 127),
    interval_days   SMALLINT    CHECK (interval_days BETWEEN 1 AND 365),
    start_date      DATE        NOT NULL,
    end_date        DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT recurring_rule_pattern_fields CHECK (
        (pattern = 'weekly'   AND weekdays      IS NOT NULL AND interval_days IS NULL) OR
        (pattern = 'interval' AND interval_days IS NOT NULL AND weekdays      IS NULL)
    ),
    CONSTRAINT recurring_rule_end_after_start CHECK (end_date IS NULL OR end_date >= start_date),
    -- Weekday assignment only means something for a rule that picks its dates by weekday.
    CONSTRAINT recurring_rule_weekday_plans_need_weekly
        CHECK (plan_mode <> 'weekday' OR pattern = 'weekly')
);

CREATE INDEX idx_recurring_rule_user   ON recurring_rule(user_id);
CREATE INDEX idx_recurring_rule_series ON recurring_rule(series_id);

-- Dates a rule must never generate again: an occurrence the user deleted on its own, or moved to
-- another day (the moved session lives on as a detached planned_session row).
CREATE TABLE recurring_rule_exception (
    rule_id       BIGINT NOT NULL REFERENCES recurring_rule(id) ON DELETE CASCADE,
    excluded_date DATE   NOT NULL,
    PRIMARY KEY (rule_id, excluded_date)
);

-- position is a weekday index for plan_mode='weekday' and a cycle step for 'rotation'; both stay
-- well under the upper bound, which is only here to keep a stray request from writing a huge cycle.
CREATE TABLE recurring_rule_plan (
    rule_id  BIGINT      NOT NULL REFERENCES recurring_rule(id) ON DELETE CASCADE,
    position SMALLINT    NOT NULL CHECK (position BETWEEN 0 AND 11),
    day_key  VARCHAR(16) NOT NULL,
    PRIMARY KEY (rule_id, position)
);

-- A planned calendar entry: a session of a given type on a given date, optionally linked to a
-- structured plan via day_key. session_type_id is required even when day_key is set, so every entry
-- always has a renderable color/icon. There is no reschedule-history table; rescheduling just
-- overwrites scheduled_date/scheduled_time. A day_key that no longer resolves to a day row reads
-- as "no plan linked".
--
-- Series occurrences are materialized here the first time a date range is requested, so status,
-- notes and logging work on an occurrence exactly as on a one-off session. occurrence_date
-- remembers which date the rule generated, and survives a reschedule of that row.
CREATE TABLE planned_session (
    id              BIGSERIAL   PRIMARY KEY,
    user_id         BIGINT      NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    scheduled_date  DATE        NOT NULL,
    scheduled_time  TIME,
    session_type_id BIGINT      NOT NULL REFERENCES session_type(id) ON DELETE RESTRICT,
    day_key         VARCHAR(16),
    rule_id         BIGINT      REFERENCES recurring_rule(id) ON DELETE SET NULL,
    occurrence_date DATE,
    status          VARCHAR(16) NOT NULL DEFAULT 'planned'
                        CHECK (status IN ('planned', 'done', 'skipped')),
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_planned_session_user_date ON planned_session(user_id, scheduled_date);
CREATE UNIQUE INDEX uq_planned_session_rule_occurrence
    ON planned_session(rule_id, occurrence_date) WHERE rule_id IS NOT NULL;

--rollback DROP TABLE IF EXISTS planned_session CASCADE;
--rollback DROP TABLE IF EXISTS recurring_rule_plan CASCADE;
--rollback DROP TABLE IF EXISTS recurring_rule_exception CASCADE;
--rollback DROP TABLE IF EXISTS recurring_rule CASCADE;
--rollback DROP TABLE IF EXISTS session_type CASCADE;
--rollback DROP TABLE IF EXISTS session_value CASCADE;
--rollback DROP TABLE IF EXISTS session_warmup CASCADE;
--rollback DROP TABLE IF EXISTS session CASCADE;
--rollback DROP TABLE IF EXISTS warmup_item CASCADE;
--rollback DROP TABLE IF EXISTS exercise CASCADE;
--rollback DROP TABLE IF EXISTS block CASCADE;
--rollback DROP TABLE IF EXISTS day CASCADE;
--rollback DROP TABLE IF EXISTS refresh_token CASCADE;
--rollback DROP TABLE IF EXISTS "user" CASCADE;
