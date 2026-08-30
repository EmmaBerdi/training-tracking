# Backend + Database

The frontend (`index.html`/`app.js`) is now a thin client: it reads and writes the whole app state — plan and logged workouts — through one REST API, `GET`/`PUT /api/state`, backed by Postgres. Postgres is the only source of truth; there's no local/offline copy of the data anymore.

## Quick start (Docker)

```bash
docker compose up --build
```

This starts Postgres and the backend together. Liquibase applies the schema automatically on startup. The API is then at `http://localhost:8080/api`.

## Running without Docker

Requires Java 21 and a running Postgres instance.

```bash
cd backend
createdb training_tracking   # or point DB_* env vars at an existing instance
./mvnw spring-boot:run
```

### Configuration (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `DB_HOST` | `localhost` | Postgres host |
| `DB_PORT` | `5432` | Postgres port |
| `DB_NAME` | `training_tracking` | Database name |
| `DB_USER` | `training` | Database user |
| `DB_PASSWORD` | `training` | Database password |
| `SERVER_PORT` | `8080` | Port the API listens on |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5500,http://127.0.0.1:5500` | Comma-separated origins allowed to call the API from a browser |

## Pointing the frontend at the backend

The frontend calls `window.API_BASE` if it's set before the app loads, otherwise `VITE_API_BASE` at build time, otherwise it defaults to `http://localhost:8080/api`. For a deployed build, set `window.API_BASE` in `index.html` — it just needs to run before `main.tsx`, so anywhere in `<head>` works:

```html
<script>window.API_BASE = 'https://your-backend-host/api';</script>
```

And add the frontend's origin to `CORS_ALLOWED_ORIGINS` on the backend. The local dev server (`npm run dev`) runs on `http://localhost:5500`, which is already in the default allowlist below.

## Schema

Migrations are managed by [Liquibase](https://docs.liquibase.com/), which Spring Boot runs on
startup (`spring.liquibase` in `application.yml`):

| Path | Purpose |
|---|---|
| `db/changelog/db.changelog-master.xml` | Root changelog — no changesets of its own, just the ordered `<include>` list |
| `db/changelog/changes/001-init-schema.sql` | The whole schema in one changeset |
| `db/changelog/changes/002-exercise-image.sql` | Setup photos: the `exercise_image` table and `exercise.image_id` |
| `liquibase.properties` | Datasource for the `liquibase-maven-plugin` only; the app itself uses `application.yml` |

`001-init-schema.sql` is the flattened end state of the eight incremental Flyway migrations that
came before it, verified by diffing a database built from it against one built by replaying
V1–V8 — same tables, columns, constraints, indexes and seeded `session_type` ids. It's a
[formatted SQL changelog](https://docs.liquibase.com/concepts/changelogs/sql-format.html): plain
SQL apart from the `--changeset` marker comments, so it also runs on its own against an empty
database, without Liquibase in the picture at all:

```bash
psql -d training_tracking -f backend/src/main/resources/db/changelog/changes/001-init-schema.sql
```

What it creates:

Table and column names are singular throughout — one row is one user, one day, one exercise — so a
table is named after the thing a row holds. `"user"` is a reserved word in PostgreSQL and is always
double-quoted; `day` is reserved in H2, so both entities carry a backtick-quoted `@Table` name that
Hibernate rewrites into whichever quote character the dialect wants.

- `"user"`, `refresh_token` — accounts; refresh tokens are stored hashed so they stay revocable.
- `day`, `block`, `exercise`, `warmup_item` — the training plan; every block belongs to exactly one day.
- `session`, `session_warmup`, `session_value` — logged workouts: one `session` row per date+day, with checked-off warmup items and per-set logged values hanging off it.
- `session_type`, `recurring_rule`, `recurring_rule_plan`, `recurring_rule_exception`, `planned_session` — the calendar: activity kinds, repeating series and the sessions they generate.

### Adding a change

Add a file under `db/changelog/changes/` and one `<include>` line to the master changelog. Do not
edit a changeset that has already been deployed — Liquibase stores a checksum per changeset in
`DATABASECHANGELOG` and refuses to start when a deployed one no longer matches.

Useful commands (they need `liquibase.properties` to point at the right database):

```bash
cd backend
./mvnw liquibase:status         # what would be applied
./mvnw liquibase:updateSQL      # print the DDL instead of running it
./mvnw liquibase:rollback -Dliquibase.rollbackCount=1
```

### Adopting it on a database that already has the schema

The baseline changeset carries a
[precondition](https://docs.liquibase.com/concepts/changelogs/preconditions.html) — "run only if
there is no `"user"` table" — with `onFail:MARK_RAN`. A database that was already migrated by Flyway
therefore records the changeset as run without re-executing it, and starting the backend is all it
takes. The leftover `flyway_schema_history` table is unused after that and can be dropped.

If you'd rather be explicit, `./mvnw liquibase:changelogSync` does the same marking without
starting the application.

Every `PUT /api/state` call replaces the entire contents of these tables in one transaction (the app always saves the whole state at once, so there's no partial-update path to reconcile). Deleting an exercise from the plan also deletes its historical logged values, since they no longer have anything valid to reference.

## Exercise setup photos

One picture per exercise, on its own endpoints because JSON is the wrong envelope for image bytes:

| Call | Answer |
|---|---|
| `POST /api/exercise-images` (multipart, field `file`) | `201 {"id","width","height"}` |
| `GET /api/exercise-images/{id}` | the bytes, `Cache-Control: private, immutable` |

Both require the bearer token, and every query is scoped by owner — another user's id answers `404`,
not `403`, so the endpoint doesn't confirm that the id exists. A plan naming an id its owner doesn't
hold is rejected by `PUT /api/state` with `400`; without that check, pasting a stranger's id into
your own plan would read their picture back out of your own `GET /api/state`.

The bytes are a `bytea` column rather than a file on disk: no volume to provision, and the picture
is inside the same backup as everything else. Uploads are capped at 2 MB, and the stored content
type comes from what an `ImageIO` reader recognises in the bytes rather than from the client's
header, so a renamed non-image is rejected outright.

**Why images live in their own table.** `PUT /api/state` deletes and recreates every exercise row of
a user on each save, and the frontend saves on every plan edit. Anything held on that row has to be
re-sent by the client every time — cheap for a UUID, absurd for a few hundred KB of JPEG. So the
plan carries `exercise.image_id` and the picture keeps its own identity across the wipe. The other
side of that is orphans: a save also deletes this user's images that no exercise points at any more,
skipping any uploaded within the last hour, since the upload necessarily answers before the plan
that will reference it has been saved.

## Deploying for real use

This only covers local development. For anything beyond that you'll need to:
- Run Postgres somewhere durable (a managed instance is simplest) and set the `DB_*` variables accordingly.
- Build and run the backend as a normal Spring Boot jar (`./mvnw package` → `java -jar backend/target/tracking-backend-*.jar`) or the provided `backend/Dockerfile`, on a host reachable from wherever the frontend is served.
- Serve it over HTTPS if the frontend is served over HTTPS — browsers block mixed-content `fetch` calls from an HTTPS page to a plain `http://` API.
