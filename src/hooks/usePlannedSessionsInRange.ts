import { useEffect, useState } from 'react';
import type { PlannedSession } from '../types';
import { loadPlannedSessions } from '../api/plannedSessions';

/**
 * Planned sessions between `from` and `to`, loaded apart from the calendar's month so that browsing
 * another range (statistics) never moves the calendar. Reloaded whenever the range changes; the
 * previous result stays on screen meanwhile rather than flashing empty.
 */
export function usePlannedSessionsInRange(from: string, to: string) {
  const [sessions, setSessions] = useState<PlannedSession[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadPlannedSessions(from, to).then((loaded) => {
      if (cancelled) return;
      setFailed(loaded === null);
      if (loaded) setSessions(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  return { sessions, failed };
}
