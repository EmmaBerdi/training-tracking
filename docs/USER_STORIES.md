# User stories

What this app is supposed to do, told as real situations rather than a feature list. Written after
reviewing how comparable apps solve the same problems (see [Competitive notes](#competitive-notes))
and after an interview with the product owner (see [Decisions](#decisions)).

Status legend: ✅ built · 🟡 partly built · 🔴 missing

## Personas

**Emma** — the owner. Trains a self-designed calisthenics/gym program, cares about exact numbers
(box height in cm, left/right sets counted separately, band strength), plus running and bouldering
on the side. She wants the app to be a training diary *and* a schedule.

**Jonas** — a new account. Wants "running Mondays and Thursdays, 30 minutes, and bouldering on
Fridays" on a calendar. He does not want exercise lists, sets or reps, ever. He is the user the app
used to fail: he got Emma's pistol-squat program handed to him on signup.

---

## E1 — Account and first run

### US-1.1 Register and land in my own empty app ✅

> Jonas installs the PWA, taps "Registrieren", enters mail and password, and is in.

Registration, login, refresh tokens and per-user data isolation work today
(`AuthScreen`, `AuthService`, JWT filter).

Was broken: `useTrainingState.ts` seeded `defaultPlan()` — "Unterkörper + Pistol", the shared hip
block — into every brand-new account, with `dayId` hardcoded to `'mo'`, and `resetPlan()` restored
that same personal program. Now `src/data/plan.ts` exposes `emptyPlan()`, nothing is seeded, nothing
is written until the user creates something, and `Plan.hip` is optional so no one inherits a block
repeated on every day.

**Acceptance criteria**
- A new account has **no** workout plans and **no** planned sessions.
- Nothing in the app restores the pistol program; a reset, if one returns (US-7.2), clears to empty.
- Nothing in `src/data/defaultPlan.ts` describes one specific person's training.
- Emma's existing plan is untouched — it lives in Postgres, not in the seed.

### US-1.2 Get told how the app works, once ✅

> Jonas' calendar is empty. Instead of an empty grid, a short wizard asks what he wants to do,
> how often, and at what time — and when he taps through, his month is filled in.

Progressive, skippable onboarding is the consensus pattern: ask the few things that unlock the
first useful screen, and teach the rest in place (Fitbod asks only about experience before showing
a first workout). A wizard is justified here because there *is* a required setup sequence — an empty
calendar is a dead end.

**Acceptance criteria**
- Runs only when the account has no plans and no planned sessions; never again after that.
- Every step is skippable; skipping lands on the calendar with an inviting empty state
  ("Noch nichts geplant — tippe auf einen Tag").
- Step 1: pick activities from the seeded types (Laufen, Kraft, Bouldern, …) or create one.
- Step 2: per activity, a rhythm — weekdays or "alle N Tage" — plus a time.
- Step 3: summary, "Los geht's", which writes real recurring rules and lands on the calendar.
- The wizard explains, in one line each, the two things Jonas cannot guess: that tapping a
  calendar day plans a session, and that an activity can carry a detailed workout plan if he wants
  one.
- Re-runnable on demand from the user menu ("Einführung nochmal ansehen").

### US-1.3 Log out on a shared device ✅

> Emma hands her tablet to a friend and logs out first.

Built (`UserMenu` → `onLogout`). Tokens cleared, back to `AuthScreen`.

---

## E2 — Planning: the calendar

### US-2.1 See the month at a glance ✅

> Sunday evening. Emma opens the calendar and sees the week ahead: colored pills per day.

Built (`CalendarView`, 6×7 grid, Monday-first, pills tinted per session type, done/skipped dimmed,
month navigation, "Heute").

### US-2.2 Plan a single session on a day ✅

> Emma is invited bouldering on Thursday. She taps the 27th, picks "Bouldern", saves.

Built (`AddSessionSheet` → `POST /api/planned-sessions`). The sheet never sent `time` even though
`PlannedSession.time` and `scheduled_time` both existed, so "07:00 laufen" was impossible to express
on creation; it has a time field now, and pills show it.

**Acceptance criteria**
- The add sheet has an optional time field, sent on create.
- Calendar pills show the time when one is set, ordered by time within the day.

### US-2.3 Move a session that did not fit ✅

> It rained Monday morning. Emma opens the session and moves it to Tuesday.

Built (`SessionDetailSheet` → `onReschedule`, optimistic update, rollback on failure).
Interacts with recurrence — see US-2.6.

### US-2.4 Tick a session off, or admit I skipped it ✅

> Emma got back from her run and marks it "gemacht".

Built (`markStatus`, `planned | done | skipped`).

Logging is connected to the plan: the first value entered for a workout (`logOps.startsWorkout`)
flips the session being logged from "geplant" to "erledigt" (`App.logValue`). Only the first entry
does it and only from "geplant", so neither a manual "übersprungen" nor a session deliberately set
back to "geplant" is overridden by the next set. Checking off warm-up items does not count. This
happens client-side: the log and the planned session are saved through separate APIs, and the
session being logged is known only to the view.

**Acceptance criteria**
- Logging any value for a workout on a date flips that date's matching planned session to "done"
  automatically, once, without stealing a manual "skipped".
- Manual override still wins: marking "skipped" stays skipped.

### US-2.5 Delete a session ✅

Built (`removeSession`, optimistic with rollback). Scope prompt needed once recurrence lands
(US-2.6).

### US-2.6 Set up a rhythm, not 30 single entries ✅

> Emma wants: every Monday and Thursday, gym; every third day, mobility. She sets it up once.

Built as `recurring_rule` + `recurring_rule_exception` (V4), with occurrences materialized into
`planned_session` the first time a date range is requested — so status, notes and logging work on an
occurrence exactly as on a one-off, and no read path needs to know about rules. Intervals.icu and
TrainingPeaks both treat the calendar as the primary surface with repeatable plans applied to it;
Hevy and Strong instead keep *routines* reusable and let you schedule them.

**Acceptance criteria**
- A rule carries: activity type, optional workout plan, optional time, and a pattern —
  either **weekly on chosen weekdays** or **every N days**.
- Start date, optional end date; open-ended is allowed and renders indefinitely into future months.
- Occurrences appear in the calendar visually identical to single sessions, with a subtle
  repeat marker.
- Different plans on different weekdays, in **one** series: *Monday → Beine, Thursday → Arme*
  (plan mode `weekday`, V7). Two separate rules still work, but are no longer the only way.
- A series can rotate an ordered cycle of plans instead — *Beine / Push / Pull*, one step per date,
  independent of the weekday (plan mode `rotation`, V7). A cycle of three brings each plan back
  every third session.
- One rule per activity+pattern; editing the rule updates all future occurrences at once. The
  rhythm and the plan assignment are edited through `PUT /api/recurring-rules/{id}`, which splits
  the series at the chosen date exactly like a scope=future edit.

### US-2.7 Change one occurrence without wrecking the series ✅

> Emma moves *this* Monday's gym session to Tuesday because of a dentist appointment. Next Monday
> must stay Monday.

Built. The established option set is "this occurrence" / "this and all future" / "all"; Apple
Calendar shows the first two, and so does this app — no retroactive edits. A single-occurrence edit
detaches that row and records an exception; a scope=future edit splits the rule so occurrences
already generated before it keep the old pattern.

**Acceptance criteria**
- Editing, moving or deleting an occurrence of a series prompts:
  **"Nur dieser Termin"** / **"Alle künftigen Termine"**.
- "Nur dieser Termin" writes an exception, so the series is otherwise untouched.
- "Alle künftigen Termine" reaches the *end of the series*, not merely the next earlier edit: the
  rules a series was split into are chained by `series_id` (V8), and the half taking over from a
  date makes the later halves step aside. Without the chain, a second edit made on an earlier half
  produced a rule overlapping its own successors — two sessions on every date after the older
  split — which also made it impossible to switch a once-edited series to per-weekday or rotating
  plans.
- Deleting a single occurrence hides exactly that date, permanently, and survives a reload.
- Deleting all future occurrences ends the series at that date; past occurrences and their logged
  data remain.
- No prompt at all for a session that is not part of a series.
- Skipping or deleting one date of a **rotating** series asks what becomes of the plan it was
  carrying: *verfallen lassen* (the missed date keeps its cycle step, later dates are untouched) or
  *nachholen* (the missed plan moves to the next date and the rest slides one step along).

### US-2.8 Recurrence, but the plan changes over time ✅

> After eight weeks Emma swaps the Monday plan from "Aufbau" to "Intensiv".

Falls out of US-2.7: edit the rule, choose "alle künftigen Termine", done. Explicitly *not* in
scope: periodized multi-week programs that progress weights automatically (Hevy Trainer territory).

---

## E3 — Activity types

### US-3.1 Pick from sensible activities out of the box ✅

> Jonas expects "Laufen" to already exist. It does — but it is called "Jogging".

Eight types are seeded globally (`V3__add_session_types_and_planned_sessions.sql`), which is right.
They were seeded in **English** (`Jogging`, `Strength`, …) inside an otherwise German app; V5
renames the global rows in place, so ids and every reference to them survive.

**Acceptance criteria**
- Seeded labels are German: Laufen, Kraft, Bouldern, Radfahren, Schwimmen, Yoga / Mobility,
  Ruhetag, Sonstiges.
- Renaming is a migration on the global rows only; user-created types are untouched, and existing
  planned sessions keep pointing at the same ids.

### US-3.2 Add my own activity with its own color ✅

> Emma starts climbing outdoors and adds "Klettern" in pink.

Built (`AddSessionSheet` → "+ Neu", label + color + optional icon, per-user, unique per user).

### US-3.3 Clean up an activity I no longer use ✅

> Emma stopped swimming and wants "Schwimmen" out of her chip row.

Built: selecting a custom type in `AddSessionSheet` offers „… löschen“ with a confirmation. The
backend refuses while a planned session, a series or a workout plan still uses the type (`409`),
which surfaces as "Kategorie wird noch von einem Termin oder Plan verwendet". Global types are
undeletable (`custom: false`).

**Acceptance criteria**
- Custom types are deletable where they are shown, with the "noch verwendet" conflict surfaced as a
  readable message rather than a silent failure.

---

## E4 — Workout plans

### US-4.1 Create a workout plan for an activity ✅

> Emma creates "Oberkörper" and attaches it to "Kraft". Jonas never opens this screen.

Built: `PlanSheet` asks for title, short label and the activity (required, no preselection), and
the same sheet changes it later. `day.session_type_id` (changeset `003`) stores it; `slot` is gone.
Existing plans were given the type they were scheduled under most often, and unscheduled ones
"Kraft". Every scheduling picker (`AddSessionSheet`, `SessionDetailSheet`) lists only the chosen
type's plans, and hides the plan field entirely for a type that has none. A plan already attached
from another type stays listed, so opening an older entry never silently drops its plan.

**Acceptance criteria**
- A plan belongs to exactly one session type, chosen on creation and changeable later from inside
  the plan.
- Scheduling flows type-first: pick "Kraft" → pick which Kraft plan (or none). Types without plans
  (Laufen) never ask.
- `slot` is dropped in favour of the session time.

### US-4.2 Several plans under one activity ✅

> "Gym" is not one workout. Emma has Oberkörper, Unterkörper and Ganzkörper, all Gym.

Directly from the interview, and the reason type and plan must stay separate concepts rather than
collapsing into one.

Built: any number of plans per type. The scheduling pickers show only that type's plans; the
edit-mode tab strip groups plans by type and underlines them in the type's color; calendar pills
show the pinned plan's short label (full title on hover) and the type name otherwise.

**Acceptance criteria**
- Any number of plans per type; the plan picker groups them under their type.
- The calendar pill shows the plan name when one is pinned, the type name otherwise.

### US-4.3 Build up the plan's content ✅

> Emma adds a "Kraft" block, puts "Bulgarian Split Squat" in it, unilateral, 3 sets left, 3 right.

Built and genuinely good: blocks by kind, bilateral/unilateral exercises with separate left/right
set counts, seven measurement types (kg, band, sek, bw, cm, m, min), reps as free text, notes,
reordering, edit mode (`ExerciseEditor`, `planOps`).

### US-4.4 Rename or delete a plan I no longer use ✅

> The "Testphase" plan was a dead end. Emma wants it gone.

Built: in edit mode, „Plan bearbeiten“ (`PlanSheet`) renames a plan and „Plan löschen“ deletes it
after a confirmation; blocks are deleted from their header (`BlockSection`), also confirmed.
Sessions pointing at a deleted plan keep their `day_key`, which then reads as "no plan linked";
logged workouts keep theirs too.

**Acceptance criteria**
- Plans can be renamed and deleted from edit mode, with a confirmation.
- Deleting a plan leaves past logs readable and detaches — not deletes — planned sessions that
  pointed at it (`day_id ON DELETE SET NULL` already does the right thing).
- Blocks can be deleted.

### US-4.5 Remind me what an exercise is ✅

Built (`InfoSheet` shows the exercise's own description, written in `ExerciseEditor`).

### US-4.6 Show me what the setup looks like ✅

> The plyo session starts with a box jump. Emma set the box to a specific height and photographed
> it once; on the next session she wants to see that photo rather than remember a number.

Built: one picture per exercise. Attached in edit mode (`ExerciseEditor`), shown as a thumbnail on
the exercise card during the workout, and full size in the info sheet behind it.

**How it works**
- The picker's photo is downscaled to 1600px and re-encoded as JPEG in the browser
  (`utils/image.ts`) before upload — this converts the iPhone's HEIC, keeps a photo at a couple of
  hundred KB, and drops the EXIF block including the GPS coordinates of where it was taken.
- The bytes go to `POST /api/exercise-images` and live in their own table; the plan stores only the
  id that came back. That is what lets a picture survive the delete-and-recreate of every exercise
  row that each plan save performs.
- Removing a picture clears the reference. The backend collects images nothing points at any more
  on the next save, once they are over an hour old.

---

## E5 — Doing the training

### US-5.1 Open the app and see today's training ✅

> Monday 06:55. Emma opens the app and wants Monday's gym workout, nothing else.

Was: the Plan tab (`Tabs.tsx`) rendered **every** plan unconditionally, with no relation to what was
scheduled — the second half of the "still focused on my old gym plan" complaint. Now the strip is
schedule-driven in log mode, and plan-driven only in edit mode (an unscheduled plan still has to be
editable, which is the one deviation from the original acceptance criteria).

**Acceptance criteria**
- The tab strip shows **only days with something scheduled** in the current month — Mon, Tue, Fri
  if that is what is planned; the empty days in between do not appear.
- The strip scrolls horizontally, left and right, within the month.
- The day matching the selected date is preselected and scrolled into view.
- Each tab shows weekday and date plus the plan or activity name.
- Nothing scheduled all month → an empty state pointing at the calendar, not a blank bar.
- A scheduled activity without a plan (Laufen) shows as a tab too, with a minimal detail view —
  it is still a thing Emma did that day.

### US-5.2 Log a set the moment I finish it ✅

> Between sets, thumb on the phone: tap the set, type 62.5, done.

Built (`ExerciseTrack` → `EntrySheet`, per side and set index, immediate persist).

### US-5.3 See what I lifted last time ✅

> Emma cannot remember Monday's weight. The previous value sits greyed next to the input.

Built (`lastVal`, most recent earlier session for that exercise/side/set).

### US-5.4 Tick off the warm-up ✅

Built (`WarmupSection`, per-session checkboxes).

### US-5.5 Jump from a calendar entry into the workout ✅

> Emma taps Monday's gym pill, then "Training starten".

Built (`SessionDetailSheet` → `onStartWorkout` → switches `dayId` and view). Requires the session
to have a plan linked.

### US-5.6 Log something I did yesterday ✅

Built through the schedule-driven tab strip: yesterday's session is a tab like any other (earlier
months via the steppers), and selecting it logs under its date.

---

## E6 — Looking back

### US-6.1 Review a past session 🟡

`HistorySheet` was removed together with the data sheet (commit `c8505f3`). A past session can
still be opened from the tab strip or the calendar, and shows the values logged for it; there is
no list of all logged workouts any more.

### US-6.2 See whether I actually did what I planned ✅

> End of month: Emma wants to know whether "3× Kraft pro Woche" happened.

Weekly totals are the one feature every planning app in this space converges on (Intervals.icu
shows them per week on the calendar itself).

Built: a strip under the month grid (`CalendarView`, `state/weekTotals.ts`), one row per
calendar week (KW) that has anything scheduled — "Kraft 2/3" is two of three done, with skipped
sessions counted separately. A week straddling the month boundary is counted whole.

**Acceptance criteria**
- Per week, per type: planned / done / skipped counts, on or next to the calendar.
- Cheap version first: a compact strip under the month grid. No charts, no training-load model.

### US-6.3 Track progress on one exercise 🔴

> "Was my box pistol height going down?" — the numbers are logged, but only readable session by
> session.

Deliberately parked; noted so it is not mistaken for an oversight.

---

## E7 — Data and account

### US-7.1 Export and import my data 🔴

Removed together with `DataSheet` (commit `c8505f3`); the user menu has no export. Backups are a
server concern for now: `deploy/backup.sh` runs a nightly `pg_dump` on the Pi.

### US-7.2 Start over 🔴

> Emma wants a clean slate.

"Alle Pläne löschen" went away with the data sheet (commit `c8505f3`). Plans can still be deleted
one at a time (US-4.4), and "Einführung nochmal ansehen" moved to the user menu.

---

## Decisions

From the interview, these are settled and not up for re-litigation while implementing:

| Question | Decision |
|---|---|
| First run | Wizard that asks activities, rhythm and time, and writes real recurring entries |
| Starter templates | **Dropped.** No template library, no starter programs |
| Default plan | No plan is seeded for anyone; the pistol program is not offered at all |
| Recurrence | Real recurring rules: weekly on chosen weekdays, or every N days |
| Plan per date | Three modes: one fixed plan, one plan per weekday, or a rotating cycle |
| Missed date in a rotation | The user decides per case: let the plan lapse, or carry it to the next date |
| Editing an occurrence | Apple-Calendar prompt: "Nur dieser Termin" / "Alle künftigen Termine" |
| Series end | Open-ended allowed; optional end date; no retroactive edits to past sessions |
| Session fields | Date, time, type, note. **No** duration, **no** distance, **no** logged actuals |
| Plan ↔ type | A plan belongs permanently to one type; the type is editable from within the plan |
| Multiple plans per type | Required — several Gym plans, scheduled individually |
| Recurrence ↔ plan | A rule decides which plan each date gets: fixed, per weekday, or rotating |
| Plan tab scope | Only days with something scheduled, horizontally scrollable, within the month |
| Language | German; seeded English type labels get renamed |

## Competitive notes

What the neighbours do, and what this app should take from them.

- **Hevy / Strong** — routine-centric strength logging: reusable routines, folders, one-tap
  pre-made programs, and scheduling on top. Hevy added algorithmic programming that auto-progresses
  weights (Feb 2026). *Take:* routines (our plans) are reusable objects, scheduled repeatedly, not
  bound to a date. *Leave:* auto-progression, social feed.
- **Intervals.icu / TrainingPeaks** — calendar-first: drag a workout from a library onto a day,
  planned vs. completed side by side, weekly totals, plans applied in bulk. *Take:* the calendar as
  the primary surface, weekly planned-vs-done totals (US-6.2). *Leave:* training-load modelling,
  device sync.
- **Apple Calendar / Google Calendar** — the recurrence UX everyone already knows: flexible
  patterns, and a scope prompt on edit and delete. *Take:* verbatim, minus the "all events"
  (retroactive) option.
- **Fitbod and fitness onboarding generally** — progressive, skippable onboarding: ask the minimum
  that unlocks a useful first screen, teach the rest in place. *Take:* three short steps, all
  skippable, ending on a filled calendar.

## Built so far

1. **No seeded plan** (US-1.1, 7.2) — `defaultPlan()` gone, `emptyPlan()` in its place, `Plan.hip`
   optional, reset clears to empty.
2. **Recurring rules** (US-2.6, 2.7, 2.8) — V4: `recurring_rule`, `recurring_rule_exception`,
   `rule_id`/`occurrence_date` on `planned_session`; weekly-mask and every-N-days patterns;
   materialization on range read; scope-aware move/edit/delete with rule splitting;
   `POST /api/recurring-rules`; `scope` on the planned-session write endpoints, which answer 204 when
   a change hit the rest of a series.
3. **Onboarding wizard** (US-1.2) — three skippable German steps that write real rules.
4. **Schedule-driven Plan tab** (US-5.1) — log mode shows only scheduled days of the month with
   month steppers; edit mode still lists plans.
5. **Time on create** (US-2.2) and **German seed labels** (US-3.1, V5).
6. **Plan links survive a plan save** — `planned_session.day_id` was a FK to `day(id)`, which
   `PUT /api/state` deletes and recreates on every save, silently nulling the link. Now stored as
   `day_key`.
7. **Plan modes on a series** (US-2.6, 2.7) — V7: `plan_mode` + `rotation_offset` on
   `recurring_rule`, `recurring_rule_plan` for the per-weekday and per-cycle-step plans. The plan
   for a date is a pure function of the rule and the date, so re-materializing or skipping an
   occurrence never reshuffles the cycle; `rotation_offset` is what lets a split half carry on
   mid-cycle. `rotation=hold|shift` on skip and single-occurrence delete, and
   `GET`/`PUT /api/recurring-rules/{id}` for editing the series itself.
8. **Series are chains** (US-2.7) — V8: `series_id` on `recurring_rule`, and one invariant enforced
   in `splitAt`/`endSeriesAt`: at most one half of a series generates any given date. Halves that
   were already split apart before V8 stay separate series; nothing recorded what they belonged to.
9. **Plan ↔ type binding** (US-4.1, 4.2) — changeset `003`: `day.session_type_id` replaces
   `slot`, backfilled from how each plan was scheduled; type-first pickers; plans grouped by type.
10. **Auto-done on logging** (US-2.4) — the first logged value ticks the session off.
11. **Weekly planned-vs-done strip** (US-6.2) — per KW and type, under the month grid.
12. **Cleanup UI confirmed** (US-3.3, 4.4) — deleting custom types, plans and blocks was already
    wired; the backend now also refuses to delete a type a plan still belongs to.

## Still open

1. **History list, export/import, start over** (US-6.1, 7.1, 7.2) — removed with the data sheet
   in `c8505f3`; decide whether they come back, in the user menu.
2. **Progress per exercise** (US-6.3) — deliberately parked.

## Resolved

- **Language:** German only. No i18n layer, no language switch — new copy is written in German like
  the rest of the app.
- **Month boundaries:** the strip stays inside one month. At the end of it, a small arrow button
  labelled "nächster Monat" moves on (and its mirror image for the previous month).
