import { useState } from 'react';
import type { Exercise, Side, WorkoutLog } from '../../types';
import { SIDE_LABEL } from '../../data/constants';
import {
  exerciseRecords,
  exerciseSeries,
  exerciseSides,
  sideGap,
  type WorkoutPoint,
} from '../../state/stats';
import { formatDayLabel } from '../../utils/date';
import {
  formatDelta,
  formatNumber,
  formatSet,
  formatSigned,
  formatValue,
} from '../../utils/format';
import { LineChart, type ChartSeries } from '../LineChart/LineChart';
import styles from './ExerciseStats.module.scss';

interface ExerciseStatsProps {
  exercise: Exercise;
  logs: WorkoutLog[];
  /** First date of the range on screen; null for everything. Records ignore it. */
  from: string | null;
  /** More room for the chart, where the screen has it to spare. */
  tall?: boolean;
}

type Metric = 'best' | 'volume' | 'e1rm';

const SIDE_COLOR: Record<Side, string> = {
  B: 'var(--chart-left)',
  L: 'var(--chart-left)',
  R: 'var(--chart-right)',
};

function metricValue(p: WorkoutPoint, metric: Metric): number | null {
  return metric === 'best' ? p.best : metric === 'volume' ? p.volume : p.e1rm;
}

export function ExerciseStats({ exercise: x, logs, from, tall = false }: ExerciseStatsProps) {
  const [metric, setMetric] = useState<Metric>('best');
  const sides = exerciseSides(x);
  const pointsBySide = sides.map((side) => ({
    side,
    points: exerciseSeries(logs, x.id, side, x.type, from),
  }));
  const hasPoints = pointsBySide.some((s) => s.points.length > 0);

  // Volume and estimated max only exist once reps were logged; until then they are not offered.
  const metrics: { key: Metric; label: string }[] = [{ key: 'best', label: 'Bester Satz' }];
  if (pointsBySide.some((s) => s.points.some((p) => p.volume !== null)))
    metrics.push({ key: 'volume', label: x.type === 'bw' ? 'Wdh gesamt' : 'Volumen' });
  if (pointsBySide.some((s) => s.points.some((p) => p.e1rm !== null)))
    metrics.push({ key: 'e1rm', label: 'Geschätztes Max' });
  const shown = metrics.some((m) => m.key === metric) ? metric : 'best';
  const shownLabel = metrics.find((m) => m.key === shown)?.label ?? '';

  const format = (v: number) =>
    shown === 'best'
      ? formatValue(v, x.type)
      : shown === 'e1rm'
        ? formatValue(v, 'kg')
        : `${formatNumber(v)} ${x.type === 'bw' ? 'Wdh' : 'kg'}`;

  const series: ChartSeries[] = pointsBySide.map(({ side, points }) => ({
    key: side,
    label: side === 'B' ? shownLabel : SIDE_LABEL[side],
    color: SIDE_COLOR[side],
    points: points.flatMap((p) => {
      const value = metricValue(p, shown);
      return value === null ? [] : [{ date: p.date, value }];
    }),
  }));
  // Beside a single best-set line, the average shows whether the whole workout moved or one set.
  if (shown === 'best' && sides.length === 1) {
    series.push({
      key: 'avg',
      label: 'Durchschnitt',
      color: 'var(--mute)',
      muted: true,
      points: pointsBySide[0].points.map((p) => ({ date: p.date, value: p.avg })),
    });
  }

  const gap =
    sides.length === 2 ? sideGap(pointsBySide[0].points, pointsBySide[1].points, x.type) : null;

  const rows = logs
    .filter((l) => (!from || l.date >= from) && sides.some((s) => l.vals[x.id]?.[s]?.some(Boolean)))
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <section className={styles.exercise}>
      <h2 className={styles.title}>{x.name}</h2>

      {!hasPoints ? (
        <p className={styles.empty}>Noch keine Werte in diesem Zeitraum.</p>
      ) : (
        <>
          {metrics.length > 1 && (
            <div className={styles.metrics} role="group" aria-label="Messgrösse">
              {metrics.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className={`${styles.chip} ${m.key === shown ? styles.chipOn : ''}`}
                  aria-pressed={m.key === shown}
                  onClick={() => setMetric(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}

          <div className={styles.summary}>
            {series
              .filter((s) => !s.muted)
              .map((s) => {
                const first = s.points[0];
                const last = s.points[s.points.length - 1];
                const delta = s.points.length > 1 ? last.value - first.value : null;
                return (
                  <div key={s.key} className={styles.stat}>
                    <span className={styles.statLabel}>{s.label}</span>
                    <span className={styles.statValue}>{last ? format(last.value) : '–'}</span>
                    {delta !== null && (
                      <span className={styles.statDelta}>
                        {shown === 'best'
                          ? formatDelta(delta, x.type)
                          : formatSigned(delta, format)}{' '}
                        seit {formatDayLabel(first.date)}
                      </span>
                    )}
                  </div>
                );
              })}
          </div>

          <LineChart
            series={series}
            format={format}
            integerTicks={shown === 'best' && x.type === 'band'}
            height={tall ? 300 : 200}
            label={`${x.name}: ${shownLabel} je Training`}
          />

          {series.length > 1 && (
            <ul className={styles.legend}>
              {series.map((s) => (
                <li key={s.key}>
                  <span className={styles.key} style={{ background: s.color }} />
                  {s.label}
                </li>
              ))}
            </ul>
          )}

          {gap && (
            <p className={styles.note}>
              {SIDE_LABEL[gap.weaker]} {gap.percent} % schwächer im letzten Training.
            </p>
          )}
        </>
      )}

      <Records exercise={x} logs={logs} sides={sides} />

      {rows.length > 0 && (
        <details className={styles.table}>
          <summary>Alle Trainings als Tabelle</summary>
          <table>
            <thead>
              <tr>
                <th>Datum</th>
                {sides.length > 1 && <th>Seite</th>}
                <th>Sätze</th>
              </tr>
            </thead>
            <tbody>
              {rows.flatMap((log) =>
                sides.map((side) => (
                  <tr key={`${log.date}-${log.dayId}-${side}`}>
                    <td>{formatDayLabel(log.date)}</td>
                    {sides.length > 1 && <td>{SIDE_LABEL[side]}</td>}
                    <td>
                      {(log.vals[x.id]?.[side] ?? [])
                        .map((v, i) => formatSet(v, log.reps?.[x.id]?.[side]?.[i]))
                        .filter(Boolean)
                        .join(' · ') || '–'}
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
}

/** All-time bests, so a short range on screen never hides a record set earlier. */
function Records({
  exercise: x,
  logs,
  sides,
}: {
  exercise: Exercise;
  logs: WorkoutLog[];
  sides: Side[];
}) {
  const bySide = sides.map((side) => ({
    side,
    records: exerciseRecords(logs, x.id, side, x.type),
  }));
  if (!bySide.some((s) => s.records.best)) return null;
  return (
    <div className={styles.records}>
      <h3 className={styles.subtitle}>Rekorde</h3>
      {bySide.map(({ side, records }) =>
        records.best ? (
          <div key={side} className={styles.recordSide}>
            <div className={styles.recordRow}>
              <span>
                {side === 'B' ? 'Bester Satz' : `Bester Satz ${SIDE_LABEL[side].toLowerCase()}`}
              </span>
              <strong>
                {formatSet(formatValue(records.best.value, x.type), records.best.reps)}
              </strong>
              <span className={styles.recordDate}>{formatDayLabel(records.best.date)}</span>
            </div>
            {records.byReps.map((r) => (
              <div key={r.reps} className={styles.recordRow}>
                <span>{r.reps} Wdh</span>
                <strong>{formatValue(r.value, x.type)}</strong>
                <span className={styles.recordDate}>{formatDayLabel(r.date)}</span>
              </div>
            ))}
          </div>
        ) : null,
      )}
    </div>
  );
}
