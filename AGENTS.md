# AGENTS.md

Instructions for AI coding agents (Claude Code, Copilot, Cursor, etc.) working in this repository.

## Project overview

Personal training PWA: a React + TypeScript + SCSS frontend (Vite) backed by a Java/Spring Boot
REST API and Postgres. See `README.md` for the full layout table and `docs/BACKEND.md` /
`docs/SETUP.md` for backend and deployment details.

- Frontend: `src/` (components, hooks, state, api client, styles)
- Backend: `backend/` (Spring Boot, Maven, JWT auth, Postgres schema in `backend/src/main/resources/db`)
- Local stack: `docker-compose.yml` (Postgres + backend)

## Best practices — required, not optional

Agents must follow general software engineering best practices at all times, in addition to
anything project-specific below. This includes, but is not limited to:

- **Correctness first.** Understand existing code before changing it. Don't guess at behavior —
  read the relevant files, tests, and docs.
- **Minimal, focused changes.** Solve the task asked; don't refactor, rename, or "clean up"
  unrelated code in the same change. No speculative abstractions or unused flexibility for
  hypothetical future needs.
- **Security.** Never introduce injection vulnerabilities (SQL, command, XSS), never log or commit
  secrets/credentials, and treat all external input (HTTP requests, JWTs, query params) as
  untrusted. This app has multi-tenant auth (JWT) — be careful not to weaken tenant isolation or
  auth checks.
- **Consistency with existing conventions.** Match the style already in the file/module you're
  editing (naming, error handling, folder structure) rather than inventing a new pattern. In
  particular: a style rule wanted by a second component moves to `src/styles/shared.module.scss`;
  a closed set of string values gets a DB `CHECK` plus named constants, never bare literals; and
  the client's own ids (`day_key`, `exercise.client_id`) are what cross-table references store,
  because `PUT /api/state` recreates every plan row on each save.
- **No dead code.** Don't leave commented-out code, unused imports, or placeholder
  TODO-without-context behind.
- **Comments only where non-obvious.** Explain *why*, not *what*. Don't restate what well-named
  code already says.
- **Test before declaring done.** Run the relevant checks below for anything you touched. Don't
  claim a task is complete without having verified it.
- **Don't touch data or infra destructively without confirmation.** No dropping/altering the
  Postgres schema, no force-pushing, no deleting migrations, no `docker compose down -v`, without
  explicit user approval — this app stores real personal training data.

## Commands

Frontend (run from repo root):

```bash
npm install         # install deps
npm run dev          # dev server, http://localhost:5500
npm run build         # tsc -b && vite build
npm run lint          # eslint .
npm test              # vitest run (state/ and utils/ unit tests)
```

Format with Prettier (`.prettierrc.json`: single quotes, 100 col width) before finishing frontend work.

Backend (run from `backend/`):

```bash
./mvnw test           # run backend tests (StateServiceTest, AuthFlowTest, JwtServiceTest, etc.)
./mvnw spring-boot:run # run backend locally (applies the Liquibase changelog on startup)
./mvnw liquibase:status # pending changesets against the DB in liquibase.properties
```

Schema changes go in a new file under `src/main/resources/db/changelog/changes/` plus an
`<include>` in `db.changelog-master.xml` — never by editing a deployed changeset, whose checksum
Liquibase has already recorded. See [`docs/BACKEND.md`](docs/BACKEND.md).

Local full stack:

```bash
docker compose up --build
```

## Verification checklist before finishing a task

- [ ] `npm run lint` passes for any frontend change
- [ ] `npm test` passes for any change under `src/state/` or `src/utils/`
- [ ] `npm run build` succeeds if TypeScript types or build config changed
- [ ] `./mvnw test` passes for any backend change (especially anything touching `security/` or auth)
- [ ] No secrets, tokens, or real personal training data added to the repo
- [ ] Changes match the scope of the request — nothing unrelated was refactored
