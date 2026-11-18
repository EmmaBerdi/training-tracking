import { useState } from 'react';
import type { Plan, SessionType, WorkoutLog } from '../../types';
import {
  STATS_RANGE_LABEL,
  STATS_RANGES,
  consistency,
  planSummary,
  rangeStart,
  type Consistency,
  type StatsRange,
} from '../../state/stats';
import { dayExercises, sortByType } from '../../state/planOps';
import { MAX_LOAD_DAYS } from '../../api/plannedSessions';
import { usePlannedSessionsInRange } from '../../hooks/usePlannedSessionsInRange';
import { BREAKPOINT, useMinWidth } from '../../hooks/useMinWidth';
import { formatDayLabel, shiftDays, today as todayIso } from '../../utils/date';
import { sessionTypeAccent } from '../../utils/cssVar';
import { WeekBars } from '../WeekBars/WeekBars';
import { PlanStats } from '../PlanStats/PlanStats';
import { ExerciseStats } from '../ExerciseStats/ExerciseStats';
import styles from './StatsView.module.scss';

interface StatsViewProps {
  plan: Plan;
  logs: WorkoutLog[];
  types: SessionType[];
}

export function StatsView({ plan, logs, types }: StatsViewProps) {
  const [range, setRange] = useState<StatsRange>('3m');
  const [dayId, setDayId] = useState<string | null>(null);
  const [exId, setExId] = useState<string | null>(null);
  const wide = useMinWidth(BREAKPOINT.tablet);

  const today = todayIso();
  const from = rangeStart(range, today);
  // Consistency reaches back a year at most, so "Alle" shows the last twelve months there.
  const yearAgo = shiftDays(today, -(MAX_LOAD_DAYS - 1));
  const sessionsFrom = from && from > yearAgo ? from : yearAgo;
  const { sessions, failed } = usePlannedSessionsInRange(sessionsFrom, today);

  // A plan or exercise deleted meanwhile simply drops the view back a level.
  const day = plan.days.find((d) => d.id === dayId);
  const exercises = day ? dayExercises(day) : [];
  const exercise = exercises.find((x) => x.id === exId);
  const typeById = new Map(types.map((t) => [t.id, t]));

  const openPlan = (id: string) => {
    setDayId(id);
    setExId(null);
  };

  // Side by side there is always room for an exercise, so a plan opens on one: the first with
  // anything logged, else simply the first.
  const shownExercise =
    exercise ??
    (wide ? (exercises.find((x) => logs.some((l) => l.vals[x.id])) ?? exercises[0]) : undefined);

  const filters = (
    <div className={styles.filters} role="group" aria-label="Zeitraum">
      {STATS_RANGES.map((r) => (
        <button
          key={r}
          type="button"
          className={`${styles.range} ${r === range ? styles.rangeOn : ''}`}
          aria-pressed={r === range}
          onClick={() => setRange(r)}
        >
          {STATS_RANGE_LABEL[r]}
        </button>
      ))}
    </div>
  );

  const consistencyCard = (
    <section className={styles.card}>
      <h2 className={styles.heading}>
        Regelmässigkeit{range === 'all' ? ' · letzte 12 Monate' : ''}
      </h2>
      {failed && !sessions ? (
        <p className={styles.empty}>Termine konnten nicht geladen werden.</p>
      ) : sessions ? (
        <ConsistencySummary result={consistency(sessions, sessionsFrom, today)} types={types} />
      ) : null}
    </section>
  );

  const planList = (
    <section>
      <h2 className={styles.heading}>Pläne</h2>
      {plan.days.length === 0 && (
        <p className={styles.empty}>Noch keine Pläne — lege im Plan-Modus einen an.</p>
      )}
      <ul className={styles.plans}>
        {sortByType(plan.days, types).map((d) => {
          const summary = planSummary(logs, d.id, from);
          const type = typeById.get(d.sessionTypeId);
          return (
            <li key={d.id}>
              <button
                type="button"
                className={styles.planRow}
                style={sessionTypeAccent(type)}
                onClick={() => openPlan(d.id)}
              >
                <span className={styles.planDot} />
                <span className={styles.planName}>{d.title}</span>
                <span className={styles.planMeta}>
                  {summary.workouts} {summary.workouts === 1 ? 'Training' : 'Trainings'}
                  {summary.lastDate && ` · zuletzt ${formatDayLabel(summary.lastDate)}`}
                </span>
                <span className={styles.chevron} aria-hidden="true">
                  ›
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );

  const planStats = day && (
    <>
      <button type="button" className={styles.back} onClick={() => setDayId(null)}>
        ‹ Übersicht
      </button>
      <PlanStats
        day={day}
        logs={logs}
        from={from}
        selectedExId={wide ? (shownExercise?.id ?? null) : null}
        onSelectExercise={setExId}
      />
    </>
  );

  if (wide) {
    return (
      <div className={styles.stats}>
        {filters}
        <div className={day ? styles.columnsDetail : styles.columns}>
          {day ? (
            <>
              <div>{planStats}</div>
              <div>
                {shownExercise && (
                  <ExerciseStats exercise={shownExercise} logs={logs} from={from} tall />
                )}
              </div>
            </>
          ) : (
            <>
              {consistencyCard}
              {planList}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.stats}>
      {filters}
      {exercise && day ? (
        <>
          <button type="button" className={styles.back} onClick={() => setExId(null)}>
            ‹ {day.title}
          </button>
          <ExerciseStats exercise={exercise} logs={logs} from={from} />
        </>
      ) : day ? (
        planStats
      ) : (
        <>
          {consistencyCard}
          {planList}
        </>
      )}
    </div>
  );
}

function ConsistencySummary({ result, types }: { result: Consistency; types: SessionType[] }) {
  if (!result.due && result.weeks.every((w) => w.types.length === 0)) {
    return <p className={styles.empty}>In diesem Zeitraum war nichts geplant.</p>;
  }
  return (
    <>
      <div className={styles.tiles}>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Erledigt</span>
          <span className={styles.tileValue}>
            {result.rate === null ? '–' : `${Math.round(result.rate * 100)} %`}
          </span>
          <span className={styles.tileSub}>
            {result.done} von {result.due}
            {result.skipped > 0 && ` · ${result.skipped} übersprungen`}
          </span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Serie</span>
          <span className={styles.tileValue}>
            {result.streak} {result.streak === 1 ? 'Woche' : 'Wochen'}
          </span>
          <span className={styles.tileSub}>alles Geplante erledigt</span>
        </div>
      </div>
      <WeekBars weeks={result.weeks} types={types} />
    </>
  );
}
