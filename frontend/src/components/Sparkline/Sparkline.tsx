import styles from './Sparkline.module.scss';

const W = 72;
const H = 24;
const PAD = 3;

/**
 * A trend at a glance beside a number, so decorative to screen readers: the change next to it says
 * the same in words. The line stays in the recessive grey; only the latest workout carries colour.
 */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <span className={styles.empty} aria-hidden="true" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const x = (i: number) => PAD + (i / (values.length - 1)) * (W - 2 * PAD);
  const y = (v: number) =>
    max === min ? H / 2 : PAD + (1 - (v - min) / (max - min)) * (H - 2 * PAD);
  const last = values.length - 1;
  return (
    <svg className={styles.spark} width={W} height={H} aria-hidden="true">
      <polyline
        className={styles.line}
        points={values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}
      />
      <circle className={styles.end} cx={x(last)} cy={y(values[last])} r={3} />
    </svg>
  );
}
