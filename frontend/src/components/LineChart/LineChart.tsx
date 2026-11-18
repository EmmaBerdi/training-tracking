import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useElementWidth } from '../../hooks/useElementWidth';
import { formatDayLabel, formatWeekday } from '../../utils/date';
import styles from './LineChart.module.scss';

export interface ChartSeries {
  key: string;
  label: string;
  /** A CSS colour, usually a `var(--chart-…)` token. */
  color: string;
  points: { date: string; value: number }[];
  /** Context rather than story (an average beside the best set): thinner, no end label. */
  muted?: boolean;
}

interface LineChartProps {
  series: ChartSeries[];
  format: (value: number) => string;
  /** Ticks on whole numbers only, for scales of steps such as band colours. */
  integerTicks?: boolean;
  /** What the chart shows, for screen readers. */
  label: string;
  height?: number;
}

const MARGIN = { top: 14, right: 64, bottom: 26, left: 48 };
/** Room a date label needs before the next one may sit beside it. */
const MIN_LABEL_GAP = 64;
/** Past this many workouts per line the dots crowd out the line; only the end keeps its dot. */
const MAX_DOTS = 14;

const time = (date: string) => Date.parse(date);

/** 1, 2, 2.5 or 5 times a power of ten: steps a reader can add up at a glance. */
function niceStep(span: number, integer: boolean): number {
  const raw = span / 3;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= raw) ?? raw;
  return integer ? Math.max(1, Math.round(step)) : step;
}

function scaleY(values: number[], integer: boolean) {
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= integer ? 1 : Math.max(1, Math.abs(min) * 0.1);
    max += integer ? 1 : Math.max(1, Math.abs(max) * 0.1);
  }
  const step = niceStep(max - min, integer);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let t = lo; t <= hi + step / 2; t += step) ticks.push(Number(t.toFixed(6)));
  return { lo, hi, ticks };
}

export function LineChart({
  series,
  format,
  integerTicks = false,
  label,
  height = 200,
}: LineChartProps) {
  const { ref: wrapRef, width } = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.date)))].sort();
  const values = series.flatMap((s) => s.points.map((p) => p.value));
  if (!dates.length) return null;

  const plotW = Math.max(width - MARGIN.left - MARGIN.right, 40);
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const t0 = time(dates[0]);
  const t1 = time(dates[dates.length - 1]);
  const x = (date: string) =>
    MARGIN.left + (t1 === t0 ? plotW / 2 : ((time(date) - t0) / (t1 - t0)) * plotW);
  const { lo, hi, ticks } = scaleY(values, integerTicks);
  const y = (v: number) => MARGIN.top + plotH - ((v - lo) / (hi - lo)) * plotH;

  // First and last date always; in between only those with room to either side.
  const lastX = x(dates[dates.length - 1]);
  const xLabels: string[] = [];
  for (const d of dates) {
    const prev = xLabels[xLabels.length - 1];
    if (!prev || (x(d) - x(prev) >= MIN_LABEL_GAP && lastX - x(d) >= MIN_LABEL_GAP))
      xLabels.push(d);
  }
  if (dates.length > 1) xLabels.push(dates[dates.length - 1]);

  // End labels for the story series, dropped where they would collide with one already placed.
  const endLabels: { key: string; y: number; text: string }[] = [];
  for (const s of series) {
    const last = s.points[s.points.length - 1];
    if (s.muted || !last) continue;
    const ly = y(last.value);
    if (endLabels.some((l) => Math.abs(l.y - ly) < 14)) continue;
    endLabels.push({ key: s.key, y: ly, text: format(last.value) });
  }

  const nearest = (clientX: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const px = clientX - rect.left;
    let best = 0;
    dates.forEach((d, i) => {
      if (Math.abs(x(d) - px) < Math.abs(x(dates[best]) - px)) best = i;
    });
    return best;
  };

  const onPointer = (e: PointerEvent) => setActive(nearest(e.clientX));

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const dir = e.key === 'ArrowLeft' ? -1 : 1;
      setActive((a) => Math.min(dates.length - 1, Math.max(0, (a ?? dates.length) + dir)));
    } else if (e.key === 'Escape') {
      setActive(null);
    }
  };

  const activeDate = active === null ? null : dates[active];
  const tipLeft = activeDate ? Math.min(Math.max(x(activeDate), 70), width - 70) : 0;

  return (
    <div
      ref={wrapRef}
      className={styles.wrap}
      role="group"
      aria-label={`${label}. Pfeiltasten wählen ein Training.`}
      tabIndex={0}
      onKeyDown={onKey}
      onBlur={() => setActive(null)}
    >
      <svg width={width} height={height} className={styles.svg} aria-hidden="true">
        {ticks.map((t) => (
          <g key={t}>
            <line
              className={styles.grid}
              x1={MARGIN.left}
              x2={MARGIN.left + plotW}
              y1={y(t)}
              y2={y(t)}
            />
            <text className={styles.tick} x={MARGIN.left - 6} y={y(t)} dy="0.32em" textAnchor="end">
              {format(t)}
            </text>
          </g>
        ))}
        {xLabels.map((d, i) => (
          <text
            key={d}
            className={styles.tick}
            x={x(d)}
            y={height - 8}
            textAnchor={
              i === 0 && dates.length > 1 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'
            }
          >
            {formatDayLabel(d)}
          </text>
        ))}

        {activeDate && (
          <line
            className={styles.crosshair}
            x1={x(activeDate)}
            x2={x(activeDate)}
            y1={MARGIN.top}
            y2={MARGIN.top + plotH}
          />
        )}

        {series.map((s) => (
          <g key={s.key}>
            <path
              className={s.muted ? styles.lineMuted : styles.line}
              stroke={s.color}
              d={s.points
                .map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`)
                .join(' ')}
            />
            {!s.muted &&
              s.points.map((p, i) =>
                s.points.length <= MAX_DOTS ||
                i === s.points.length - 1 ||
                p.date === activeDate ? (
                  <circle
                    key={p.date}
                    className={styles.dot}
                    cx={x(p.date)}
                    cy={y(p.value)}
                    r={4}
                    fill={s.color}
                  />
                ) : null,
              )}
          </g>
        ))}

        {endLabels.map((l) => (
          <text
            key={l.key}
            className={styles.endLabel}
            x={MARGIN.left + plotW + 9}
            y={l.y}
            dy="0.32em"
          >
            {l.text}
          </text>
        ))}

        {/* The whole plot is the hit target: the crosshair snaps to the nearest workout. */}
        <rect
          className={styles.hit}
          x={MARGIN.left - 12}
          y={0}
          width={plotW + 24}
          height={height}
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          onPointerLeave={(e) => {
            if (e.pointerType === 'mouse') setActive(null);
          }}
        />
      </svg>

      {activeDate && (
        <div className={styles.tooltip} style={{ left: tipLeft }} role="status">
          <div className={styles.tipDate}>
            {formatWeekday(activeDate)} {formatDayLabel(activeDate)}
          </div>
          {series.map((s) => {
            const point = s.points.find((p) => p.date === activeDate);
            return point ? (
              <div key={s.key} className={styles.tipRow}>
                <span className={styles.tipKey} style={{ background: s.color }} />
                <strong>{format(point.value)}</strong>
                <span className={styles.tipLabel}>{s.label}</span>
              </div>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}
