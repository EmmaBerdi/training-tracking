import type { Day, ExerciseType, PlannedSession, RecurringRule, Side } from '../../types';

/** Which sheet is open, and the subject it was opened for. */
export type SheetState =
  | { type: 'info'; exId: string }
  | { type: 'entry'; exId: string; side: Side; index: number; name: string; exType: ExerciseType }
  | { type: 'newPlan' }
  | { type: 'editPlan'; day: Day }
  | { type: 'addSession'; date: string }
  | { type: 'sessionDetail'; session: PlannedSession }
  /**
   * The rule is loaded before the sheet opens, so the form can start out filled in. `from` is the
   * date the edit applies from — the occurrence it was opened on, matching "alle künftigen Termine".
   */
  | { type: 'editSeries'; rule: RecurringRule; from: string }
  | null;
