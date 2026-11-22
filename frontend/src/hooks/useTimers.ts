import { useCallback, useEffect, useState } from 'react';
import type { IntervalTimer, IntervalTimerInput } from '../types';
import { createTimer, deleteTimer, loadTimers, updateTimer } from '../api/timers';

/** The user's interval timers. Each change waits for the backend, which assigns ids and checks ranges. */
export function useTimers(notify: (message: string) => void) {
  const [timers, setTimers] = useState<IntervalTimer[]>([]);

  // `notify` is stable, so this loads once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await loadTimers();
      if (cancelled) return;
      if (data) setTimers(data);
      else notify('Timer konnten nicht geladen werden');
    })();
    return () => {
      cancelled = true;
    };
  }, [notify]);

  const addTimer = useCallback(
    async (input: IntervalTimerInput) => {
      const created = await createTimer(input);
      if (!created) {
        notify('Timer konnte nicht angelegt werden');
        return null;
      }
      setTimers((prev) => [...prev, created]);
      return created;
    },
    [notify],
  );

  const saveTimer = useCallback(
    async (id: number, input: IntervalTimerInput) => {
      const updated = await updateTimer(id, input);
      if (!updated) {
        notify('Timer konnte nicht gespeichert werden');
        return null;
      }
      setTimers((prev) => prev.map((t) => (t.id === id ? updated : t)));
      return updated;
    },
    [notify],
  );

  const removeTimer = useCallback(
    async (id: number) => {
      if (!(await deleteTimer(id))) {
        notify('Timer konnte nicht gelöscht werden');
        return false;
      }
      setTimers((prev) => prev.filter((t) => t.id !== id));
      return true;
    },
    [notify],
  );

  return { timers, addTimer, saveTimer, removeTimer };
}
