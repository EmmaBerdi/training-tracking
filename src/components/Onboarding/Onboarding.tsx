import { useState } from 'react';
import type { NewRecurringRule, RecurrencePattern, SessionType } from '../../types';
import { defaultSessionTypeColor, sessionTypeAccent } from '../../utils/cssVar';
import { WEEKDAY_SHORT } from '../../utils/date';
import styles from './Onboarding.module.scss';

interface OnboardingProps {
  types: SessionType[];
  /** The date the generated series start on. */
  startDate: string;
  onAddType: (input: { label: string; color?: string }) => Promise<SessionType | null>;
  onFinish: (rules: NewRecurringRule[]) => Promise<void>;
  onSkip: () => void;
}

/** One activity the user picked, with the rhythm they want it on. */
interface Draft {
  typeId: number;
  pattern: RecurrencePattern;
  weekdays: number;
  intervalDays: number;
  time: string;
}

const MONDAY = 1;
const DEFAULT_INTERVAL_DAYS = 3;
const STEPS = 3;

function describe(draft: Draft): string {
  if (draft.pattern === 'interval') {
    const every = draft.intervalDays === 1 ? 'jeden Tag' : `alle ${draft.intervalDays} Tage`;
    return draft.time ? `${every}, ${draft.time}` : every;
  }
  const days = WEEKDAY_SHORT.filter((_, i) => draft.weekdays & (1 << i)).join(', ');
  const when = days || 'kein Tag gewählt';
  return draft.time ? `${when}, ${draft.time}` : when;
}

export function Onboarding({ types, startDate, onAddType, onFinish, onSkip }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const typeById = new Map(types.map((t) => [t.id, t]));

  const toggleType = (typeId: number) =>
    setDrafts((prev) =>
      prev.some((d) => d.typeId === typeId)
        ? prev.filter((d) => d.typeId !== typeId)
        : [
            ...prev,
            {
              typeId,
              pattern: 'weekly',
              weekdays: MONDAY,
              intervalDays: DEFAULT_INTERVAL_DAYS,
              time: '',
            },
          ],
    );

  const patchDraft = (typeId: number, patch: Partial<Draft>) =>
    setDrafts((prev) => prev.map((d) => (d.typeId === typeId ? { ...d, ...patch } : d)));

  const handleAddType = async () => {
    const label = newLabel.trim();
    if (!label) return;
    setSaving(true);
    const created = await onAddType({ label, color: defaultSessionTypeColor() });
    setSaving(false);
    if (created) {
      setNewLabel('');
      toggleType(created.id);
    }
  };

  const handleFinish = async () => {
    setSaving(true);
    await onFinish(
      drafts.map((d) => ({
        sessionTypeId: d.typeId,
        time: d.time || undefined,
        pattern: d.pattern,
        weekdays: d.pattern === 'weekly' ? d.weekdays : undefined,
        intervalDays: d.pattern === 'interval' ? d.intervalDays : undefined,
        startDate,
        // The first run has no workout plans yet, so there is nothing to vary across the dates;
        // per-weekday plans and rotations are set up later, in the add-session sheet.
        planMode: 'fixed' as const,
        plans: [],
      })),
    );
    setSaving(false);
  };

  // A weekly rhythm with no weekday selected has nothing to generate.
  const ready =
    drafts.length > 0 && drafts.every((d) => d.pattern !== 'weekly' || d.weekdays !== 0);

  return (
    <div className={styles.overlay}>
      <div className={styles.body}>
        <div className={styles.steps}>
          {Array.from({ length: STEPS }, (_, i) => (
            <span key={i} className={`${styles.stepDot} ${i <= step ? styles.stepDotOn : ''}`} />
          ))}
        </div>

        {step === 0 && (
          <>
            <div className={styles.eyebrow}>Schritt 1 von 3</div>
            <h1 className={styles.title}>Was willst du trainieren?</h1>
            <p className={styles.text}>
              Wähle alles, was du regelmässig machst. Später kommt jederzeit Neues dazu.
            </p>
            <div className={styles.chips}>
              {types.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`${styles.chip} ${
                    drafts.some((d) => d.typeId === t.id) ? styles.chipOn : ''
                  }`}
                  style={sessionTypeAccent(t)}
                  onClick={() => toggleType(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className={styles.newRow}>
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Eigene Aktivität, z. B. Klettern"
              />
              <button type="button" onClick={handleAddType} disabled={!newLabel.trim() || saving}>
                Hinzufügen
              </button>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className={styles.eyebrow}>Schritt 2 von 3</div>
            <h1 className={styles.title}>Wie oft, und wann?</h1>
            <p className={styles.text}>
              Zum Beispiel jeden Montag um 07:00 laufen, oder alle drei Tage Mobility.
            </p>
            {drafts.map((draft) => {
              const type = typeById.get(draft.typeId);
              return (
                <div key={draft.typeId} className={styles.card} style={sessionTypeAccent(type)}>
                  <div className={styles.cardHead}>
                    <span className={styles.dot} />
                    <span className={styles.cardTitle}>{type?.label ?? 'Aktivität'}</span>
                  </div>

                  <div className={styles.modeRow}>
                    <button
                      type="button"
                      className={`${styles.mode} ${
                        draft.pattern === 'weekly' ? styles.modeOn : ''
                      }`}
                      onClick={() => patchDraft(draft.typeId, { pattern: 'weekly' })}
                    >
                      Bestimmte Wochentage
                    </button>
                    <button
                      type="button"
                      className={`${styles.mode} ${
                        draft.pattern === 'interval' ? styles.modeOn : ''
                      }`}
                      onClick={() => patchDraft(draft.typeId, { pattern: 'interval' })}
                    >
                      Alle X Tage
                    </button>
                  </div>

                  {draft.pattern === 'weekly' ? (
                    <div className={styles.weekdayGrid}>
                      {WEEKDAY_SHORT.map((label, index) => (
                        <button
                          key={label}
                          type="button"
                          className={`${styles.weekday} ${
                            draft.weekdays & (1 << index) ? styles.weekdayOn : ''
                          }`}
                          aria-pressed={(draft.weekdays & (1 << index)) !== 0}
                          onClick={() =>
                            patchDraft(draft.typeId, { weekdays: draft.weekdays ^ (1 << index) })
                          }
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <div className={styles.inlineRow}>
                    {draft.pattern === 'interval' && (
                      <div className={styles.inlineField}>
                        <label>Abstand in Tagen</label>
                        <input
                          type="number"
                          min={1}
                          max={365}
                          value={draft.intervalDays}
                          onChange={(e) =>
                            patchDraft(draft.typeId, { intervalDays: Number(e.target.value) })
                          }
                        />
                      </div>
                    )}
                    <div className={styles.inlineField}>
                      <div className={styles.labelRow}>
                        <label>Zeit (optional)</label>
                        {draft.time && (
                          <button
                            type="button"
                            className={styles.clearButton}
                            aria-label="Zeit löschen"
                            onClick={() => patchDraft(draft.typeId, { time: '' })}
                          >
                            ×
                          </button>
                        )}
                      </div>
                      <input
                        type="time"
                        value={draft.time}
                        onChange={(e) => patchDraft(draft.typeId, { time: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {step === STEPS - 1 && (
          <>
            <div className={styles.eyebrow}>Schritt 3 von 3</div>
            <h1 className={styles.title}>Das kommt in deinen Kalender</h1>
            <ul className={styles.summary}>
              {drafts.map((draft) => (
                <li key={draft.typeId} className={styles.summaryItem}>
                  <span>{typeById.get(draft.typeId)?.label ?? 'Aktivität'}</span>
                  <span className={styles.summaryWhen}>{describe(draft)}</span>
                </li>
              ))}
            </ul>
            <ul className={styles.hints}>
              <li className={styles.hint}>
                <span className={styles.hintMark}>+</span>
                <span>
                  Im Kalender einen Tag antippen, um einmalig etwas einzuplanen — oder eine weitere
                  Serie anzulegen.
                </span>
              </li>
              <li className={styles.hint}>
                <span className={styles.hintMark}>↻</span>
                <span>
                  Wiederkehrende Termine sind mit ↻ markiert. Beim Verschieben oder Löschen fragt
                  die App, ob nur dieser Termin oder alle künftigen gemeint sind.
                </span>
              </li>
              <li className={styles.hint}>
                <span className={styles.hintMark}>≡</span>
                <span>
                  Für Kraft-Trainings kannst du einen Plan mit Übungen anlegen und ihn einem Termin
                  zuordnen. Dann trägst du im Training deine Sätze direkt ein.
                </span>
              </li>
            </ul>
          </>
        )}
      </div>

      <div className={styles.footer}>
        {step < STEPS - 1 ? (
          <button
            type="button"
            className={styles.solid}
            onClick={() => setStep(step + 1)}
            disabled={step === 0 ? drafts.length === 0 : !ready}
          >
            Weiter
          </button>
        ) : (
          <button
            type="button"
            className={styles.solid}
            onClick={handleFinish}
            disabled={!ready || saving}
          >
            Los geht's
          </button>
        )}
        <div className={styles.footRow}>
          <button
            type="button"
            className={styles.link}
            onClick={() => (step === 0 ? onSkip() : setStep(step - 1))}
          >
            {step === 0 ? 'Überspringen' : 'Zurück'}
          </button>
          {step > 0 && (
            <button type="button" className={styles.link} onClick={onSkip}>
              Überspringen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
