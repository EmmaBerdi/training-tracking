# Interval timer — plan

Working plan for branch `feat/interval-timer`. The decisions section is the source of truth; update
it whenever one changes.

## Decisions

| # | Decision |
|---|----------|
| 1 | Timers are stored on the **backend**, per user. |
| 2 | Timers are created on their own **timer page**, reached from **Plan mode** (header button next to „+ Plan“, and „Timer verwalten…“ in the exercise editor). |
| 3 | A new exercise type **`interval`** („Intervall“) in the existing type dropdown. Choosing it shows a timer picker in the exercise editor. |
| 4 | A timer describes **one round**: prepare once, then a list of **intervals** (rows), each work + rest, run in order — e.g. 40/10 then 60/10. The **number of rounds** is set per exercise (the exercise's `sets` field, labelled „Runden“ for this type). |
| 5 | Interval exercises log **no values per set**, only the **effort rating** (leicht / mittel / schwer), with the same chips as everywhere else — always shown for this type. |
| 6 | **Beeps only**, no voice. |
| 7 | Interval exercises are bilateral; the uni toggle is hidden for this type. |
| 8 | Finishing a timer run counts like the first logged value: it ticks a still-„geplant“ session off as done. |

## Data model

### Backend — `009-interval-timer.sql`

- Table `interval_timer`: `id`, `user_id` FK → `"user"` (cascade), `name`, `prepare_sec`,
  `work_sec`, `rest_sec`; `CHECK` ranges on every number (seconds 0–3600, work ≥ 1).
- `chk_exercise_type` is replaced to add `'interval'` (drop + add, as 007 did for `kcal`).
- `exercise.timer_id` FK → `interval_timer(id) ON DELETE SET NULL`. Storing the server id is fine
  here: timers are never recreated, unlike the plan rows `PUT /api/state` rebuilds.
- New `<include>` in `db.changelog-master.xml`; no deployed changeset is edited.

### Backend — `010-interval-timer-steps.sql`

- Table `interval_timer_step` (`timer_id`, `position`, `work_sec` 1–3600, `rest_sec` 0–3600), the
  intervals of a round in order; at most 20 per timer (`IntervalTimerRequest.MAX_STEPS`).
- Each existing timer's `work_sec`/`rest_sec` becomes its first interval, then those columns are
  dropped. A separate changeset rather than an edit of 009, which had already run on a local DB.

### Backend — code

- `IntervalTimer` entity, repository, `IntervalTimerService`, `IntervalTimerController` at
  `/api/timers` (GET, POST, PUT `/{id}`, DELETE `/{id}`), every query scoped to the caller.
- `ExerciseDto`: `type` pattern gains `interval`; new `timerId` field.
- `StateService.saveState`: rejects a `timerId` that isn't the caller's (400, like foreign images).
  No carry-over for older clients, unlike `carriedSteps`: the client sends back the exercise objects
  it loaded, spread on every edit, so an older PWA keeps `timerId` without knowing about it — and a
  missing `timerId` from a current client must mean „no timer“.
- Deleting a timer unlinks its exercises in the service (`ExerciseRepository.clearTimer`); the FK's
  `ON DELETE SET NULL` backs that up in Postgres.
- Tests (`IntervalTimerServiceTest`): timer CRUD, cross-user update/delete refused and list empty,
  link survives a save, foreign link refused, deleting a timer clears links.

### Frontend

- `types.ts`: `ExerciseType` gains `'interval'`; `timerId?: number` on exercises; `IntervalTimer`.
- `constants.ts`: `UNIT.interval = 'Intervall'`, and every `Record<ExerciseType, …>` it needs.
- `api/timers.ts`, `hooks/useTimers.ts` (pattern of `sessionTypes`).
- Deleting a timer warns how many exercises use it and drops their `timerId` in the client plan, so
  the next save doesn't send a dead id.
- Plan import (`planImport.ts`) accepts `interval` as a type; timers themselves aren't importable.

## UI

- **Timer page** (Plan mode): list with name and summary („40/10 · 60/10 s“), „+ Timer“, tap to
  edit in a `Sheet`: prepare, one row per interval (work, rest, ×), „+ Intervall“ (copies the last
  row), and a „Testen“ button. The run screen shows „Intervall a / b“ under the round when a timer
  has more than one.
- **Exercise editor**: for `interval`, a timer select (your timers + „Neuer Timer…“) and „Runden“
  instead of „Sätze“.
- **Log**: an interval exercise card shows the timer summary and rounds, a „▶ Timer starten“
  button instead of set chips, and the effort chips.
- **Run screen** (`components/TimerRun/`): full screen, phase colour as background (CSS tokens,
  light + dark), big countdown, phase name, round x/y, next phase, pause/resume, skip, back, stop,
  sound on/off.

## Timer engine

- `state/timerOps.ts` (+ tests): `buildSchedule(timer, rounds) → Phase[]` (prepare once, then
  work/rest per round, no rest after the last round, zero-length phases dropped), `phaseAt(schedule,
  elapsedMs)`, `totalSeconds`.
- Time is derived from timestamps minus pauses, never by decrementing on an interval, so it stays
  correct when the browser throttles a background tab or locked screen.
- `hooks/useIntervalTimer.ts`: controls, `requestAnimationFrame` display loop, Screen Wake Lock
  (re-acquired on `visibilitychange`).

## Sounds — `utils/sound.ts`

- Web Audio oscillator beeps, no files (works offline).
- Short beep at 3-2-1, long high beep when work starts, lower beep when rest starts, three-tone
  finish.
- Scheduled on `AudioContext.currentTime` for exact timing; context created/resumed on the Start
  tap (iOS requirement); `navigator.audioSession.type = 'playback'` where supported so the iOS mute
  switch doesn't silence it.
- Sound on/off kept per device in `localStorage`.

## Order of work

1. Migration, entity, API, `StateService` changes + tests (`./mvnw test`)
2. Types, API client, hook, timer page + sheet
3. Type `interval` in the exercise editor with timer picker and „Runden“
4. `timerOps` + tests, `useIntervalTimer`, sound, run screen, log card
5. `npm run lint`, `npm test`, `npm run build`, Prettier; manual test on iPhone (installed PWA,
   mute switch on, screen locked)
