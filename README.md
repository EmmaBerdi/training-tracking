# Training Tracking

Personal training PWA, in German: a calendar for planning sessions and a diary for logging workouts. Installs on iPhone as a home-screen app, no App Store or Apple Developer account needed. Supports several accounts, each with its own data. Requires a network connection — everything lives in a Postgres database behind a small Java backend, not on the device.

## What it does

- **Calendar** — plan sessions per day, once or as a series (weekly on chosen weekdays, or every N days, optionally ending). Move, skip or delete one occurrence or everything from there on, Apple-Calendar style. Under the month grid, a weekly strip shows planned against done per activity ("Kraft 2/3").
- **Activities** — seeded types (Laufen, Kraft, Bouldern, …) plus your own, each with a color.
- **Workout plans** — optional, for activities that have structure. A plan belongs to one activity and holds blocks of exercises: bilateral or left/right sets, seven units (kg, Band, Sek., …), notes, a description and a setup photo. A series can carry one fixed plan, one per weekday, or a rotation.
- **Logging** — open a scheduled session, tap a set, enter the value; the previous value for that set is shown alongside. The first logged value marks the session as done.
- **Onboarding** — a skippable three-step wizard turns "Laufen Mo + Do, Bouldern Fr" into real series on a fresh account.

How the pieces relate: an **activity type** says *what kind* of session it is; a **planned session** (or a **series** generating them) says *when*; a **plan** says *which exercises*, and is only offered for sessions of its own type.

Status per user story, and what is still open, is tracked in [`docs/USER_STORIES.md`](docs/USER_STORIES.md).

## Stack

- Frontend: React 19 + TypeScript + SCSS modules, built with Vite; `vite-plugin-pwa` for the manifest and service worker.
- Backend: Java 21, Spring Boot 3 (Web, Data JPA, Security with JWT access + refresh tokens), Liquibase, Postgres 16.

## Layout

| Path | Purpose |
|---|---|
| `index.html` | Vite entry point |
| `src/App.tsx` | Top-level component, wires state to the page |
| `src/components/` | One folder per UI component, each with its `.tsx` and a co-located `.module.scss` |
| `src/hooks/` | `useTrainingState` (plans + logs, saved as one document) and `usePlannedSessions` (calendar, types, series) |
| `src/state/` | Pure, unit-tested logic: plan edits (`planOps`), logs (`logOps`), weekly totals (`weekTotals`) |
| `src/api/` | Typed calls against the backend; `base.ts` owns auth, refresh and error handling |
| `src/auth/` | Login state and token storage |
| `src/styles/` | Design tokens as CSS custom properties (`global.scss`) + the primitives components compose from (`shared.module.scss`) |
| `public/` | Static assets served as-is: icons, and inputs to the PWA plugin |
| `vite.config.ts` | Build config, incl. the PWA plugin |
| `backend/` | Spring Boot REST API + Liquibase-managed Postgres schema — see [`docs/BACKEND.md`](docs/BACKEND.md) |
| `docker-compose.yml` | Local stack: Postgres + backend + frontend |
| `deploy/` | Raspberry Pi deployment: compose stack, nginx reverse proxy, Cloudflare tunnel, backup script |
| `.github/workflows/deploy.yml` | Builds the frontend and deploys it to GitHub Pages on push to `main` |
| `docs/SETUP.md` | Step-by-step guide: GitHub repo → GitHub Pages → install on iPhone |
| `docs/BACKEND.md` | Running and configuring the backend + database |
| `docs/DEPLOY-PI.md` | Self-hosting the whole stack on a Raspberry Pi behind a Cloudflare tunnel |
| `docs/USER_STORIES.md` | What the app should do, and how much of it is built |
| `docs/Trainingsplan_v6.md` | The training plan the app was originally built around (German) |
| `AGENTS.md` | Conventions and the verification checklist for AI coding agents |

## Setup

1. Start the backend: see [`docs/BACKEND.md`](docs/BACKEND.md) (quickest path is `docker compose up --build`).
2. Frontend, for local development:
   ```bash
   npm install
   npm run dev
   ```
   The dev server runs on `http://localhost:5500` (matches the backend's default CORS allowlist). `npm run build` produces a static `dist/` you can serve anywhere.
3. Deploying and installing on an iPhone: see [`docs/SETUP.md`](docs/SETUP.md), or [`docs/DEPLOY-PI.md`](docs/DEPLOY-PI.md) to host everything yourself.

## Checks

```bash
npm run lint && npm test && npm run build   # frontend
cd backend && ./mvnw test                   # backend (H2, no database needed)
```

## Data and backups

Data lives in the Postgres database the backend is configured against — nothing personal is stored in this repo. The app has no export of its own, so back up the database: on the Pi, [`deploy/backup.sh`](deploy/backup.sh) runs a nightly `pg_dump` (see [`docs/DEPLOY-PI.md`](docs/DEPLOY-PI.md)); anywhere else, schedule a `pg_dump` yourself.

Schema changes ship as Liquibase changesets that the backend applies on startup. Take a backup before deploying a new version against a database that holds real data.
