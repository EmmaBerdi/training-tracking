import type {
  Block,
  BlockRef,
  Day,
  ExerciseType,
  Mode,
  SessionType,
  Side,
  WorkoutLog,
} from '../../types';
import { DayHeader } from '../DayHeader/DayHeader';
import { WarmupSection } from '../WarmupSection/WarmupSection';
import { BlockSection } from '../BlockSection/BlockSection';
import type { BlockActions, ExerciseActions, WarmupActions } from '../actions';
import styles from './DayView.module.scss';

interface DayViewProps {
  day: Day;
  /** The activity the plan belongs to, named under its title. */
  type: SessionType | undefined;
  mode: Mode;
  warmup: string[];
  log: WorkoutLog | undefined;
  warmOpen: boolean;
  onToggleWarmOpen: () => void;
  onToggleWarmupItem: (index: number) => void;
  warmupActions: WarmupActions;
  getVal: (exId: string, side: Side, i: number) => string;
  lastVal: (exId: string, side: Side, i: number) => string;
  onOpenInfo: (exId: string) => void;
  onOpenEntry: (exId: string, side: Side, i: number, name: string, type: ExerciseType) => void;
  actions: ExerciseActions;
  blockActions: BlockActions;
  onEditPlan: () => void;
  /** Opens the session behind this view; absent in edit mode, where no session is being shown. */
  onOpenSession?: () => void;
}

/** A block's identity within the plan is its position on its day, which is also its React key. */
function refFor(day: Day, index: number): BlockRef {
  return { dayId: day.id, index };
}

export function DayView({
  day,
  type,
  mode,
  warmup,
  log,
  warmOpen,
  onToggleWarmOpen,
  onToggleWarmupItem,
  warmupActions,
  getVal,
  lastVal,
  onOpenInfo,
  onOpenEntry,
  actions,
  blockActions,
  onEditPlan,
  onOpenSession,
}: DayViewProps) {
  const editing = mode === 'edit';

  return (
    <>
      <DayHeader day={day} type={type} />

      {editing && (
        <div className={styles.planRow}>
          <button type="button" className={styles.planEdit} onClick={onEditPlan}>
            Plan bearbeiten
          </button>
        </div>
      )}

      {/* Without this the only way back to the appointment — its date, its plan, its series — is
          the calendar, because attaching a plan replaces the session view with this one. */}
      {!editing && onOpenSession && (
        <div className={styles.planRow}>
          <button type="button" className={styles.planEdit} onClick={onOpenSession}>
            Termin bearbeiten
          </button>
        </div>
      )}

      <WarmupSection
        items={warmup}
        log={log}
        open={warmOpen}
        editing={editing}
        onToggleOpen={onToggleWarmOpen}
        onToggleItem={onToggleWarmupItem}
        actions={warmupActions}
      />

      {day.blocks.map((block: Block, index: number) => (
        <BlockSection
          key={`${day.id}-${index}`}
          block={block}
          blockRef={refFor(day, index)}
          isFirst={index === 0}
          isLast={index === day.blocks.length - 1}
          editing={editing}
          getVal={getVal}
          lastVal={lastVal}
          onOpenInfo={onOpenInfo}
          onOpenEntry={onOpenEntry}
          actions={actions}
          blockActions={blockActions}
        />
      ))}

      {editing && (
        <div className={styles.block}>
          <button
            type="button"
            className={styles.addButton}
            onClick={() => blockActions.addBlock(day.id)}
          >
            + Block hinzufügen
          </button>
        </div>
      )}
    </>
  );
}
