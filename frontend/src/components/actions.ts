import type { BlockKind, BlockRef, Exercise, ExerciseType, IntervalTimer, Rating } from '../types';
import type { ExerciseSetsField, ExerciseTextField, StepField } from '../state/planOps';
import type { StepSuggestion } from '../state/progression';

/** Plan edits that target one block, threaded from useTrainingState down to the editors. */
export interface BlockActions {
  addBlock: (dayId: string) => void;
  deleteBlock: (ref: BlockRef) => void;
  moveBlock: (ref: BlockRef, dir: -1 | 1) => void;
  setBlockName: (ref: BlockRef, name: string) => void;
  setBlockKind: (ref: BlockRef, kind: BlockKind) => void;
}

export interface ExerciseActions {
  addExercise: (ref: BlockRef) => void;
  deleteExercise: (ref: BlockRef, exId: string) => void;
  moveExercise: (ref: BlockRef, exId: string, dir: -1 | 1) => void;
  setUni: (ref: BlockRef, exId: string, uni: boolean) => void;
  setType: (ref: BlockRef, exId: string, type: ExerciseType) => void;
  setTimer: (ref: BlockRef, exId: string, timerId: number | undefined) => void;
  setText: (ref: BlockRef, exId: string, field: ExerciseTextField, value: string) => void;
  setSets: (ref: BlockRef, exId: string, field: ExerciseSetsField, value: number) => void;
  addStep: (ref: BlockRef, exId: string) => void;
  setStepField: (
    ref: BlockRef,
    exId: string,
    index: number,
    field: StepField,
    value: string,
  ) => void;
  removeStep: (ref: BlockRef, exId: string, index: number) => void;
  setStep: (ref: BlockRef, exId: string, index: number) => void;
  /**
   * Attaches setup photos after the existing ones. Resolves once the uploads have been stored, so
   * the editor can show that it is busy — a photo takes a moment over mobile data.
   */
  addImages: (ref: BlockRef, exId: string, files: File[]) => Promise<void>;
  removeImage: (ref: BlockRef, exId: string, imageId: string) => void;
}

/** What logging needs for a planned progression: the effort ratings and moving up a step. */
export interface ProgressActions {
  getRating: (exId: string) => Rating | undefined;
  rate: (exId: string, rating: Rating | null) => void;
  suggestNext: (x: Exercise) => StepSuggestion | null;
  setStep: (ref: BlockRef, exId: string, index: number) => void;
}

/** The user's interval timers: picked in the editor, run from the log. */
export interface TimerActions {
  timers: IntervalTimer[];
  /** Opens the timer page; given an exercise, straight on a new timer that gets linked to it. */
  manage: (link?: { ref: BlockRef; exId: string }) => void;
  run: (x: Exercise) => void;
}

export interface WarmupActions {
  addWarmupItem: () => void;
  deleteWarmupItem: (index: number) => void;
  moveWarmupItem: (index: number, dir: -1 | 1) => void;
  setWarmupText: (index: number, value: string) => void;
}
