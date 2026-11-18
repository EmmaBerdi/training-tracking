import styles from './Toast.module.scss';

export function Toast({ message }: { message: string | null }) {
  return <div className={`${styles.toast} ${message ? styles.on : ''}`}>{message}</div>;
}
