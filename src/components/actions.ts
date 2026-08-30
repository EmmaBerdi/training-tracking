import type { BlockKind, BlockRef, ExerciseType } from '../types';
import type { ExerciseSetsField, ExerciseTextField } from '../state/planOps';

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
  setText: (ref: BlockRef, exId: string, field: ExerciseTextField, value: string) => void;
  setSets: (ref: BlockRef, exId: string, field: ExerciseSetsField, value: number) => void;
  /**
   * Attaches a setup photo, or removes it when passed null. Resolves once the upload has been
   * stored, so the editor can show that it is busy — a photo takes a moment over mobile data.
   */
  setImage: (ref: BlockRef, exId: string, file: File | null) => Promise<void>;
}

export interface WarmupActions {
  addWarmupItem: () => void;
  deleteWarmupItem: (index: number) => void;
  moveWarmupItem: (index: number, dir: -1 | 1) => void;
  setWarmupText: (index: number, value: string) => void;
}
