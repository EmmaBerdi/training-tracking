import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  EditScope,
  NewRecurringRule,
  PlannedSession,
  PlannedSessionStatus,
  Rotation,
  RuleUpdate,
  SessionType,
} from '../types';
import {
  loadPlannedSessions,
  createPlannedSession,
  updatePlannedSession,
  reschedulePlannedSession,
  updatePlannedSessionStatus,
  deletePlannedSession,
  SERIES_CHANGED,
} from '../api/plannedSessions';
import { loadSessionTypes, createSessionType, deleteSessionType } from '../api/sessionTypes';
import { createRecurringRule, loadRecurringRule, updateRecurringRule } from '../api/recurringRules';
import { monthRange } from '../utils/date';

export function usePlannedSessions(notify: (message: string) => void) {
  const [sessions, setSessions] = useState<PlannedSession[]>([]);
  const [types, setTypes] = useState<SessionType[]>([]);
  const [range, setRange] = useState(() => monthRange(new Date()));
  const [ready, setReady] = useState(false);
  /** Bumped to refetch the visible range after a change that touched a whole series. */
  const [reloadNonce, setReloadNonce] = useState(0);

  // `notify` is stable, so this loads once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await loadSessionTypes();
      if (cancelled) return;
      if (data) setTypes(data);
      else notify('Kategorien konnten nicht geladen werden');
    })();
    return () => {
      cancelled = true;
    };
  }, [notify]);

  // Reloaded whenever the visible range changes, or a series edit invalidated it.
  const latestFetch = useRef(0);
  useEffect(() => {
    const token = ++latestFetch.current;
    (async () => {
      const data = await loadPlannedSessions(range.from, range.to);
      if (token !== latestFetch.current) return;
      if (data) setSessions(data);
      else notify('Termine konnten nicht geladen werden');
      setReady(true);
    })();
  }, [range.from, range.to, reloadNonce, notify]);

  const setVisibleRange = useCallback((from: string, to: string) => {
    setRange((prev) => (prev.from === from && prev.to === to ? prev : { from, to }));
  }, []);

  const reload = useCallback(() => setReloadNonce((n) => n + 1), []);

  /**
   * Applies an optimistic patch, then reconciles with what the server actually stored. Both the
   * patch and the rollback go through the updater form, so a concurrent change to another session
   * is never clobbered by a stale snapshot.
   */
  const optimistically = useCallback(
    async <T>(
      patch: (session: PlannedSession) => PlannedSession,
      id: number,
      send: () => Promise<T | null>,
      failure: string,
    ): Promise<T | null> => {
      let rolledBack: PlannedSession | undefined;
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s;
          rolledBack = s;
          return patch(s);
        }),
      );
      const result = await send();
      if (result === null) {
        setSessions((prev) => prev.map((s) => (s.id === id && rolledBack ? rolledBack : s)));
        notify(failure);
        return null;
      }
      if (result === SERIES_CHANGED) {
        reload();
        return result;
      }
      setSessions((prev) => prev.map((s) => (s.id === id ? (result as PlannedSession) : s)));
      return result;
    },
    [notify, reload],
  );

  const addSession = useCallback(
    async (input: {
      date: string;
      time?: string;
      sessionTypeId: number;
      dayId?: string;
      notes?: string;
    }) => {
      const created = await createPlannedSession(input);
      if (!created) {
        notify('Termin konnte nicht angelegt werden');
        return null;
      }
      setSessions((prev) => [...prev, created]);
      return created;
    },
    [notify],
  );

  const updateSession = useCallback(
    (
      id: number,
      patch: { sessionTypeId: number; dayId?: string; notes?: string },
      scope: EditScope = 'one',
    ) =>
      optimistically(
        (s) => (scope === 'one' ? { ...s, ...patch } : s),
        id,
        () => updatePlannedSession(id, { ...patch, scope }),
        'Änderung konnte nicht gespeichert werden',
      ),
    [optimistically],
  );

  const reschedule = useCallback(
    (id: number, date: string, time?: string, scope: EditScope = 'one') =>
      optimistically(
        (s) => (scope === 'one' ? { ...s, date, time } : s),
        id,
        () => reschedulePlannedSession(id, { date, time, scope }),
        'Verschieben fehlgeschlagen',
      ),
    [optimistically],
  );

  /** `rotation: 'shift'` carries the plan of a skipped occurrence over to the next date. */
  const markStatus = useCallback(
    (id: number, status: PlannedSessionStatus, rotation?: Rotation) =>
      optimistically(
        (s) => ({ ...s, status }),
        id,
        () => updatePlannedSessionStatus(id, status, rotation),
        'Status konnte nicht gespeichert werden',
      ),
    [optimistically],
  );

  const removeSession = useCallback(
    async (id: number, scope: EditScope = 'one', rotation?: Rotation) => {
      let removed: PlannedSession | undefined;
      setSessions((prev) =>
        prev.filter((s) => {
          if (s.id !== id) return true;
          removed = s;
          return false;
        }),
      );
      const ok = await deletePlannedSession(id, scope, rotation);
      if (!ok) {
        if (removed) setSessions((prev) => [...prev, removed as PlannedSession]);
        notify('Löschen fehlgeschlagen');
        return false;
      }
      // Ending a series drops every later occurrence, and carrying a missed plan over re-plans
      // them — either way more changed than the row we removed locally.
      if (scope === 'future' || rotation === 'shift') reload();
      return true;
    },
    [notify, reload],
  );

  /**
   * Creates every rule before reloading, so onboarding's handful of rules costs one range refetch
   * instead of one per rule.
   */
  const addRules = useCallback(
    async (inputs: NewRecurringRule[]) => {
      let created = 0;
      for (const input of inputs) {
        if (await createRecurringRule(input)) created += 1;
      }
      if (created < inputs.length) notify('Wiederholung konnte nicht angelegt werden');
      if (created > 0) reload();
      return created;
    },
    [notify, reload],
  );

  const addRule = useCallback(
    async (input: NewRecurringRule) => (await addRules([input])) === 1,
    [addRules],
  );

  const loadRule = useCallback(
    async (id: number) => {
      const rule = await loadRecurringRule(id);
      if (!rule) notify('Serie konnte nicht geladen werden');
      return rule;
    },
    [notify],
  );

  /** Redefines a series from `input.from` onwards, which re-plans every occurrence after it. */
  const updateRule = useCallback(
    async (id: number, input: RuleUpdate) => {
      const updated = await updateRecurringRule(id, input);
      if (!updated) {
        notify('Serie konnte nicht gespeichert werden');
        return false;
      }
      reload();
      return true;
    },
    [notify, reload],
  );

  const addSessionType = useCallback(
    async (input: { label: string; color?: string; icon?: string }) => {
      const created = await createSessionType(input);
      if (!created) {
        notify('Kategorie konnte nicht angelegt werden');
        return null;
      }
      setTypes((prev) => [...prev, created]);
      return created;
    },
    [notify],
  );

  const removeSessionType = useCallback(
    async (id: number) => {
      let removed: SessionType | undefined;
      setTypes((prev) =>
        prev.filter((t) => {
          if (t.id !== id) return true;
          removed = t;
          return false;
        }),
      );
      const ok = await deleteSessionType(id);
      if (!ok) {
        if (removed) setTypes((prev) => [...prev, removed as SessionType]);
        notify('Kategorie wird noch von einem Termin oder Plan verwendet');
        return false;
      }
      return true;
    },
    [notify],
  );

  return {
    sessions,
    types,
    ready,
    setVisibleRange,
    reload,
    addSession,
    addRule,
    addRules,
    loadRule,
    updateRule,
    updateSession,
    reschedule,
    markStatus,
    removeSession,
    addSessionType,
    removeSessionType,
  };
}
