import { useState, type PointerEvent } from 'react';
import type { SessionType } from '../../types';
import type { ConsistencyWeek } from '../../state/stats';
import { useElementWidth } from '../../hooks/useElementWidth';
import { formatDayLabel, isoWeek } from '../../utils/date';
import { sessionTypeColor } from '../../utils/cssVar';
import styles from './WeekBars.module.scss';

interface WeekBarsProps {
  weeks: ConsistencyWeek[];
  /** In display order; a bar's segments follow it, so an activity keeps its place in every week. */
  types: SessionType[];
}

const HEIGHT = 130;
const MARGIN = { top: 10, right: 4, bottom: 22, left: 4 };
const GAP = 2;
const MAX_BAR = 24;
const RADIUS = 4;
const NOT_DONE = 'var(--line-strong)';

/** A column rounded at its data end only, square on the baseline. */
function bar(x: number, y: number, w: number, h: number, rounded: boolean): string {
  const r = rounded ? Math.min(RADIUS, h, w / 2) : 0;
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

interface Segment {
  key: string;
  label: string;
  color: string;
  count: number;
}

export function WeekBars({ weeks, types }: WeekBarsProps) {
  const { ref: wrapRef, width } = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const typeById = new Map(types.map((t) => [t.id, t]));
  const segmentsOf = (week: ConsistencyWeek): Segment[] => {
    const done = types
      .map((t) => ({ type: t, count: week.types.find((w) => w.sessionTypeId === t.id)?.done ?? 0 }))
      .filter((s) => s.count > 0)
      .map(({ type, count }) => ({
        key: String(type.id),
        label: type.label,
        color: sessionTypeColor(type),
        count,
      }));
    const open = week.types.reduce((n, w) => n + w.total - w.done, 0);
    return open
      ? [...done, { key: 'open', label: 'nicht erledigt', color: NOT_DONE, count: open }]
      : done;
  };

  const max = Math.max(1, ...weeks.map((w) => w.types.reduce((n, t) => n + t.total, 0)));
  const plotW = Math.max(width - MARGIN.left - MARGIN.right, 40);
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;
  const slot = plotW / Math.max(weeks.length, 1);
  const barW = Math.min(MAX_BAR, slot * 0.7);
  const unit = plotH / max;
  const labelEvery = Math.max(1, Math.ceil(36 / slot));

  const pick = (e: PointerEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const i = Math.floor((e.clientX - rect.left - MARGIN.left) / slot);
    setActive(i >= 0 && i < weeks.length ? i : null);
  };

  const activeWeek = active === null ? null : weeks[active];
  const tipLeft =
    active === null ? 0 : Math.min(Math.max(MARGIN.left + slot * (active + 0.5), 80), width - 80);

  // Only the activities that actually occur get a legend entry.
  const present = types.filter((t) =>
    weeks.some((w) => w.types.some((x) => x.sessionTypeId === t.id && x.done > 0)),
  );
  const anyOpen = weeks.some((w) => w.types.some((t) => t.total > t.done));

  return (
    <div className={styles.block}>
      <div ref={wrapRef} className={styles.wrap}>
        <svg width={width} height={HEIGHT} className={styles.svg} aria-hidden="true">
          <line
            className={styles.base}
            x1={MARGIN.left}
            x2={MARGIN.left + plotW}
            y1={MARGIN.top + plotH}
            y2={MARGIN.top + plotH}
          />
          {weeks.map((week, i) => {
            const segments = segmentsOf(week);
            const x0 = MARGIN.left + slot * i + (slot - barW) / 2;
            let top = MARGIN.top + plotH;
            return (
              <g key={week.start} className={active === i ? styles.barActive : undefined}>
                {segments.map((s, j) => {
                  const h = s.count * unit - (j > 0 ? GAP : 0);
                  top -= s.count * unit;
                  return (
                    <path
                      key={s.key}
                      d={bar(x0, top, barW, Math.max(h, 1), j === segments.length - 1)}
                      fill={s.color}
                    />
                  );
                })}
                {i % labelEvery === 0 && (
                  <text
                    className={styles.tick}
                    x={x0 + barW / 2}
                    y={HEIGHT - 6}
                    textAnchor="middle"
                  >
                    {isoWeek(week.start)}
                  </text>
                )}
              </g>
            );
          })}
          <rect
            className={styles.hit}
            x={MARGIN.left}
            y={0}
            width={plotW}
            height={HEIGHT}
            onPointerMove={pick}
            onPointerDown={pick}
            onPointerLeave={(e) => {
              if (e.pointerType === 'mouse') setActive(null);
            }}
          />
        </svg>

        {activeWeek && (
          <div className={styles.tooltip} style={{ left: tipLeft }} role="status">
            <div className={styles.tipDate}>
              KW {isoWeek(activeWeek.start)} · ab {formatDayLabel(activeWeek.start)}
            </div>
            {activeWeek.types.length === 0 && <div className={styles.tipLabel}>nichts geplant</div>}
            {activeWeek.types.map((t) => (
              <div key={t.sessionTypeId} className={styles.tipRow}>
                <span
                  className={styles.tipKey}
                  style={{ background: sessionTypeColor(typeById.get(t.sessionTypeId)) }}
                />
                <strong>
                  {t.done}/{t.total}
                </strong>
                <span className={styles.tipLabel}>
                  {typeById.get(t.sessionTypeId)?.label ?? 'Aktivität'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {(present.length > 0 || anyOpen) && (
        <ul className={styles.legend}>
          {present.map((t) => (
            <li key={t.id}>
              <span className={styles.swatch} style={{ background: sessionTypeColor(t) }} />
              {t.label}
            </li>
          ))}
          {anyOpen && (
            <li>
              <span className={styles.swatch} style={{ background: NOT_DONE }} />
              nicht erledigt
            </li>
          )}
        </ul>
      )}

      <details className={styles.table}>
        <summary>Als Tabelle</summary>
        <table>
          <thead>
            <tr>
              <th>Woche</th>
              <th>Erledigt</th>
              <th>Geplant</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.start}>
                <td>
                  KW {isoWeek(w.start)} · {formatDayLabel(w.start)}
                </td>
                <td>{w.types.reduce((n, t) => n + t.done, 0)}</td>
                <td>{w.types.reduce((n, t) => n + t.total, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
