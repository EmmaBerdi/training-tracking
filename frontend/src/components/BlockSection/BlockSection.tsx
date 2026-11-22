import type { Block, BlockKind, BlockRef, ExerciseType, Side } from '../../types';
import { BLOCK_KINDS, BLOCK_KIND_LABEL } from '../../data/constants';
import { blockAccent } from '../../utils/cssVar';
import { ExerciseCard } from '../ExerciseCard/ExerciseCard';
import { ExerciseEditor } from '../ExerciseEditor/ExerciseEditor';
import type { BlockActions, ExerciseActions, ProgressActions, TimerActions } from '../actions';
import styles from './BlockSection.module.scss';

interface BlockSectionProps {
  block: Block;
  blockRef: BlockRef;
  isFirst: boolean;
  isLast: boolean;
  editing: boolean;
  getVal: (exId: string, side: Side, i: number) => string;
  lastVal: (exId: string, side: Side, i: number) => string;
  getReps: (exId: string, side: Side, i: number) => string;
  lastReps: (exId: string, side: Side, i: number) => string;
  onOpenInfo: (exId: string) => void;
  onOpenEntry: (exId: string, side: Side, i: number, name: string, type: ExerciseType) => void;
  actions: ExerciseActions;
  progress: ProgressActions;
  timerActions: TimerActions;
  blockActions: BlockActions;
}

export function BlockSection({
  block,
  blockRef,
  isFirst,
  isLast,
  editing,
  getVal,
  lastVal,
  getReps,
  lastReps,
  onOpenInfo,
  onOpenEntry,
  actions,
  progress,
  timerActions,
  blockActions,
}: BlockSectionProps) {
  return (
    <section className={styles.block} style={blockAccent(block.kind)}>
      {editing ? (
        <div className={styles.blockEdit}>
          <div className={styles.blockEditRow}>
            <input
              className={styles.blockName}
              value={block.name}
              aria-label="Blockname"
              onChange={(e) => blockActions.setBlockName(blockRef, e.target.value)}
            />
            <select
              className={styles.blockKind}
              value={block.kind}
              aria-label="Blockart"
              onChange={(e) => blockActions.setBlockKind(blockRef, e.target.value as BlockKind)}
            >
              {BLOCK_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {BLOCK_KIND_LABEL[kind]}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.blockEditRow}>
            <button
              type="button"
              className={styles.smallButton}
              disabled={isFirst}
              onClick={() => blockActions.moveBlock(blockRef, -1)}
            >
              ↑ Hoch
            </button>
            <button
              type="button"
              className={styles.smallButton}
              disabled={isLast}
              onClick={() => blockActions.moveBlock(blockRef, 1)}
            >
              ↓ Runter
            </button>
            <button
              type="button"
              className={`${styles.smallButton} ${styles.danger} ${styles.pushRight}`}
              onClick={() => {
                if (
                  window.confirm(
                    `Block "${block.name}" mit allen Übungen löschen? Die dafür eingetragenen Werte werden ebenfalls gelöscht.`,
                  )
                ) {
                  blockActions.deleteBlock(blockRef);
                }
              }}
            >
              Block löschen
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.blockHead}>
          <span className={styles.accentBar} />
          <span className={styles.blockTitle}>{block.name || BLOCK_KIND_LABEL[block.kind]}</span>
        </div>
      )}

      <div className={editing ? undefined : styles.exercises}>
        {block.ex.map((x) =>
          editing ? (
            <ExerciseEditor
              key={x.id}
              exercise={x}
              blockRef={blockRef}
              actions={actions}
              timerActions={timerActions}
            />
          ) : (
            <ExerciseCard
              key={x.id}
              exercise={x}
              getVal={getVal}
              lastVal={lastVal}
              getReps={getReps}
              lastReps={lastReps}
              onOpenInfo={onOpenInfo}
              onOpenEntry={onOpenEntry}
              rating={progress.getRating(x.id)}
              onRate={(rating) => progress.rate(x.id, rating)}
              suggestion={progress.suggestNext(x)}
              onSetStep={(index) => progress.setStep(blockRef, x.id, index)}
              timers={timerActions.timers}
              onRunTimer={() => timerActions.run(x)}
            />
          ),
        )}
      </div>

      {editing && (
        <button
          type="button"
          className={styles.addButton}
          onClick={() => actions.addExercise(blockRef)}
        >
          + Übung
        </button>
      )}
    </section>
  );
}
