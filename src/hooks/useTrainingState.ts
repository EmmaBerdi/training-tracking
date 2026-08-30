import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AppState, BlockKind, BlockRef, Day, Exercise, Side, Slot } from '../types';
import { emptyPlan, uid } from '../data/plan';
import { loadState, saveState } from '../api/client';
import { uploadImage } from '../api/images';
import { prepareImage } from '../utils/image';
import type { ExerciseSetsField, ExerciseTextField } from '../state/planOps';
import * as planOps from '../state/planOps';
import * as logOps from '../state/logOps';

/** Which day is being looked at: the date logs are written under, and the plan shown for it. */
export interface Selection {
  date: string;
  dayId: string;
}

export interface DayInput {
  title: string;
  short: string;
  slot: Slot;
}

/**
 * Plan and logs for the selected day. The selection itself is controlled by the caller, because in
 * log mode it follows what the calendar has scheduled and in edit mode it follows the plan list.
 */
export function useTrainingState(notify: (message: string) => void, selection: Selection) {
  const [state, setState] = useState<AppState>(() => ({ plan: emptyPlan(), logs: [] }));
  const [open, setOpen] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const { date: selectedDate, dayId } = selection;

  const persist = useCallback(
    async (next: AppState) => {
      const ok = await saveState(next);
      if (!ok) notify('Speichern fehlgeschlagen');
    },
    [notify],
  );

  // `notify` is stable, so this loads once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await loadState();
      if (cancelled) return;
      if (data) setState({ plan: data.plan ?? emptyPlan(), logs: data.logs ?? [] });
      else notify('Laden fehlgeschlagen — Backend erreichbar?');
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [notify]);

  const updatePlan = useCallback(
    (updater: (p: AppState['plan']) => AppState['plan']) => {
      setState((prev) => {
        const next = { ...prev, plan: updater(prev.plan) };
        void persist(next);
        return next;
      });
    },
    [persist],
  );

  const updateLogs = useCallback(
    (updater: (l: AppState['logs']) => AppState['logs']) => {
      setState((prev) => {
        const next = { ...prev, logs: updater(prev.logs) };
        void persist(next);
        return next;
      });
    },
    [persist],
  );

  /** Returns the new plan so the caller can select it. */
  const addDay = useCallback(
    (input: DayInput) => {
      const day: Day = { id: uid(), ...input, blocks: [] };
      updatePlan((p) => planOps.addDay(p, day));
      return day;
    },
    [updatePlan],
  );
  const updateDay = useCallback(
    (targetDayId: string, input: DayInput) =>
      updatePlan((p) => planOps.updateDay(p, targetDayId, input)),
    [updatePlan],
  );
  const deleteDay = useCallback(
    (targetDayId: string) => updatePlan((p) => planOps.deleteDay(p, targetDayId)),
    [updatePlan],
  );

  const addBlock = useCallback(
    (forDayId: string) => updatePlan((p) => planOps.addBlockToDay(p, forDayId)),
    [updatePlan],
  );
  const deleteBlock = useCallback(
    (ref: BlockRef) => updatePlan((p) => planOps.deleteBlock(p, ref)),
    [updatePlan],
  );
  const moveBlock = useCallback(
    (ref: BlockRef, dir: -1 | 1) => updatePlan((p) => planOps.moveBlock(p, ref, dir)),
    [updatePlan],
  );
  const setBlockName = useCallback(
    (ref: BlockRef, name: string) => updatePlan((p) => planOps.setBlockName(p, ref, name)),
    [updatePlan],
  );
  const setBlockKind = useCallback(
    (ref: BlockRef, kind: BlockKind) => updatePlan((p) => planOps.setBlockKind(p, ref, kind)),
    [updatePlan],
  );

  const addExercise = useCallback(
    (ref: BlockRef) => updatePlan((p) => planOps.addExercise(p, ref)),
    [updatePlan],
  );
  const deleteExercise = useCallback(
    (ref: BlockRef, exId: string) => updatePlan((p) => planOps.deleteExercise(p, ref, exId)),
    [updatePlan],
  );
  const moveExercise = useCallback(
    (ref: BlockRef, exId: string, dir: -1 | 1) =>
      updatePlan((p) => planOps.moveExercise(p, ref, exId, dir)),
    [updatePlan],
  );
  const setExerciseUni = useCallback(
    (ref: BlockRef, exId: string, uni: boolean) =>
      updatePlan((p) => planOps.setExerciseUni(p, ref, exId, uni)),
    [updatePlan],
  );
  const setExerciseType = useCallback(
    (ref: BlockRef, exId: string, type: Exercise['type']) =>
      updatePlan((p) => planOps.setExerciseType(p, ref, exId, type)),
    [updatePlan],
  );
  const setExerciseText = useCallback(
    (ref: BlockRef, exId: string, field: ExerciseTextField, value: string) =>
      updatePlan((p) => planOps.setExerciseText(p, ref, exId, field, value)),
    [updatePlan],
  );
  const setExerciseSets = useCallback(
    (ref: BlockRef, exId: string, field: ExerciseSetsField, value: number) =>
      updatePlan((p) => planOps.setExerciseSets(p, ref, exId, field, value)),
    [updatePlan],
  );

  /**
   * The picture is uploaded first and the plan only ever stores the id that came back, so a failed
   * upload leaves the plan exactly as it was.
   */
  const setExerciseImage = useCallback(
    async (ref: BlockRef, exId: string, file: File | null) => {
      if (!file) {
        updatePlan((p) => planOps.setExerciseImage(p, ref, exId, undefined));
        return;
      }
      let uploaded;
      try {
        uploaded = await uploadImage(await prepareImage(file));
      } catch (err) {
        console.error(err);
        notify('Bild konnte nicht gelesen werden');
        return;
      }
      if (!uploaded) {
        notify('Bild hochladen fehlgeschlagen');
        return;
      }
      updatePlan((p) => planOps.setExerciseImage(p, ref, exId, uploaded.id));
    },
    [notify, updatePlan],
  );

  const addWarmupItem = useCallback(
    () => updatePlan((p) => planOps.addWarmupItem(p)),
    [updatePlan],
  );
  const deleteWarmupItem = useCallback(
    (index: number) => updatePlan((p) => planOps.deleteWarmupItem(p, index)),
    [updatePlan],
  );
  const moveWarmupItem = useCallback(
    (index: number, dir: -1 | 1) => updatePlan((p) => planOps.moveWarmupItem(p, index, dir)),
    [updatePlan],
  );
  const setWarmupText = useCallback(
    (index: number, value: string) => updatePlan((p) => planOps.setWarmupText(p, index, value)),
    [updatePlan],
  );

  const setVal = useCallback(
    (exId: string, side: Side, i: number, value: string) =>
      updateLogs((l) => logOps.setVal(l, selectedDate, dayId, exId, side, i, value)),
    [updateLogs, selectedDate, dayId],
  );
  const toggleWarmupItem = useCallback(
    (index: number) => updateLogs((l) => logOps.toggleWarmup(l, selectedDate, dayId, index)),
    [updateLogs, selectedDate, dayId],
  );

  const log = useMemo(
    () => logOps.findLog(state.logs, selectedDate, dayId),
    [state.logs, selectedDate, dayId],
  );
  const previous = useMemo(
    () => logOps.lastValues(state.logs, selectedDate),
    [state.logs, selectedDate],
  );

  const getVal = useCallback(
    (exId: string, side: Side, i: number) => logOps.getVal(log, exId, side, i),
    [log],
  );
  const lastVal = useCallback(
    (exId: string, side: Side, i: number) => previous.get(logOps.positionKey(exId, side, i)) ?? '',
    [previous],
  );

  return {
    plan: state.plan,
    logs: state.logs,
    dayId,
    selectedDate,
    open,
    ready,
    day: planOps.curDay(state.plan, dayId),
    log,
    findExercise: (id: string) => planOps.findExercise(state.plan, id),
    setOpen,
    getVal,
    lastVal,
    setVal,
    toggleWarmupItem,
    addDay,
    updateDay,
    deleteDay,
    addBlock,
    deleteBlock,
    moveBlock,
    setBlockName,
    setBlockKind,
    addExercise,
    deleteExercise,
    moveExercise,
    setExerciseUni,
    setExerciseType,
    setExerciseText,
    setExerciseSets,
    setExerciseImage,
    addWarmupItem,
    deleteWarmupItem,
    moveWarmupItem,
    setWarmupText,
  };
}
