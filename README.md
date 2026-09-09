# Training Tracking

Personal training PWA: shows the weekly plan and tracks workout progress. Installs on iPhone as a home-screen app, no App Store or Apple Developer account needed. Requires a network connection — the plan and logged workouts live in a Postgres database behind a small Java backend, not on the device.

The frontend is a React + TypeScript + SCSS single-page app, built with Vite.

## Layout

| Path | Purpose |
|---|---|
| `index.html` | Vite entry point |
| `src/App.tsx` | Top-level component, wires state to the page |
| `src/components/` | One folder per UI component, each with its `.tsx` and a co-located `.module.scss` |
| `src/hooks/useTrainingState.ts` | App state (plan, logs, current day/mode) + persistence |
| `src/state/` | Pure, immutable update functions over the plan (`planOps`) and the logs (`logOps`) |
| `src/data/` | Display constants (units, block kinds) and the empty starting plan |
| `src/api/` | Typed calls against the backend; `base.ts` owns auth, refresh and error handling |
| `src/styles/` | Design tokens as CSS custom properties (`global.scss`) + the primitives components compose from (`shared.module.scss`) |
| `public/` | Static assets served as-is: icons, and inputs to the PWA plugin |
| `vite.config.ts` | Build config, incl. `vite-plugin-pwa` (generates the manifest + service worker) |
| `backend/` | Java (Spring Boot) REST API + Liquibase-managed Postgres schema — see [`docs/BACKEND.md`](docs/BACKEND.md) |
| `docker-compose.yml` | Local dev stack: Postgres + backend |
| `deploy/` | Raspberry Pi deployment: compose stack, nginx reverse proxy, Cloudflare tunnel, backup script |
| `.github/workflows/deploy.yml` | Builds the frontend and deploys it to GitHub Pages on push to `main` |
| `docs/SETUP.md` | Step-by-step guide: GitHub repo → GitHub Pages → install on iPhone |
| `docs/BACKEND.md` | Running and configuring the backend + database |
| `docs/DEPLOY-PI.md` | Self-hosting the whole stack on a Raspberry Pi behind a Cloudflare tunnel |
| `docs/Trainingsplan_v6.md` | The underlying training plan and rationale (German) |

## Setup

1. Start the backend: see [`docs/BACKEND.md`](docs/BACKEND.md) (quickest path is `docker compose up --build`).
2. Frontend, for local development:
   ```bash
   npm install
   npm run dev
   ```
   The dev server runs on `http://localhost:5500` (matches the backend's default CORS allowlist). `npm run build` produces a static `dist/` you can serve anywhere, and `npm test` runs the unit tests.
3. Deploying and installing on an iPhone: see [`docs/SETUP.md`](docs/SETUP.md).

Data lives in the Postgres database the backend is configured against — nothing personal is stored in this repo. You can still back up via **Daten → Als JSON exportieren** in the app; that exports whatever the backend currently holds.
