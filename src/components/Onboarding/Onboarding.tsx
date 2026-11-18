import { useState } from 'react';
import type { NewRecurringRule, RecurrencePattern, SessionType } from '../../types';
import { NAV, type NavTarget } from '../../data/constants';
import { defaultSessionTypeColor, sessionTypeAccent } from '../../utils/cssVar';
import { useScrollLock } from '../../hooks/useScrollLock';
import { WEEKDAY_SHORT } from '../../utils/date';
import styles from './Onboarding.module.scss';

interface OnboardingProps {
  types: SessionType[];
  /** The date the generated series start on. */
  startDate: string;
  onAddType: (input: { label: string; color?: string }) => Promise<SessionType | null>;
  onFinish: (rules: NewRecurringRule[]) => Promise<void>;
  onSkip: () => void;
  /**
   * Reopened just to read: only the welcome and the next steps, with nothing to schedule, so
   * finishing it can never create a second copy of the user's series.
   */
  tourOnly?: boolean;
}

type Step = 'welcome' | 'activities' | 'rhythm' | 'next';

const SETUP_STEPS: Step[] = ['welcome', 'activities', 'rhythm', 'next'];
const TOUR_STEPS: Step[] = ['welcome', 'next'];

/** What each button in the bottom bar is for, in one sentence. */
const NAV_PURPOSE: Record<NavTarget, string> = {
  log: 'Das heutige Training: Sätze eintragen und abhaken.',
  edit: 'Workout-Pläne mit Blöcken und Übungen anlegen und bearbeiten.',
  calendar: 'Trainings einplanen, einmalig oder als Serie.',
  stats: 'Fortschritt je Übung, Rekorde, und wie viel vom Geplanten du erledigt hast.',
};

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

function describe(draft: Draft): string {
  if (draft.pattern === 'interval') {
    const every = draft.intervalDays === 1 ? 'jeden Tag' : `alle ${draft.intervalDays} Tage`;
    return draft.time ? `${every}, ${draft.time}` : every;
  }
  const days = WEEKDAY_SHORT.filter((_, i) => draft.weekdays & (1 << i)).join(', ');
  const when = days || 'kein Tag gewählt';
  return draft.time ? `${when}, ${draft.time}` : when;
}

export function Onboarding({
  types,
  startDate,
  onAddType,
  onFinish,
  onSkip,
  tourOnly = false,
}: OnboardingProps) {
  useScrollLock();
  const steps = tourOnly ? TOUR_STEPS : SETUP_STEPS;
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;
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
  const canContinue = step === 'activities' ? drafts.length > 0 : step === 'rhythm' ? ready : true;

  return (
    <div className={styles.overlay}>
      <div className={styles.body}>
        <div className={styles.steps}>
          {steps.map((s, i) => (
            <span
              key={s}
              className={`${styles.stepDot} ${i <= stepIndex ? styles.stepDotOn : ''}`}
            />
          ))}
        </div>
        <div className={styles.eyebrow}>
          {tourOnly ? 'Einführung' : `Schritt ${stepIndex + 1} von ${steps.length}`}
        </div>

        {step === 'welcome' && (
          <>
            <h1 className={styles.title}>Willkommen</h1>
            <p className={styles.text}>
              Hier planst du deine Trainings, legst fest, welche Übungen dazugehören, trägst ein,
              was du geschafft hast — und siehst, wie du besser wirst. Unten findest du dafür vier
              Bereiche:
            </p>
            <ul className={styles.hints}>
              {(Object.keys(NAV) as NavTarget[]).map((target) => (
                <li key={target} className={styles.hint}>
                  <span className={styles.hintMark}>{NAV[target].icon}</span>
                  <span>
                    <strong className={styles.hintTitle}>{NAV[target].label}</strong>
                    {NAV_PURPOSE[target]}
                  </span>
                </li>
              ))}
            </ul>
            {!tourOnly && (
              <p className={styles.text}>
                Zuerst kommen deine regelmässigen Trainings in den Kalender — das dauert eine
                Minute.
              </p>
            )}
          </>
        )}

        {step === 'activities' && (
          <>
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

        {step === 'rhythm' && (
          <>
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

        {step === 'next' && (
          <>
            {tourOnly ? (
              <h1 className={styles.title}>So gehst du vor</h1>
            ) : (
              <>
                <h1 className={styles.title}>Das kommt in deinen Kalender</h1>
                <ul className={styles.summary}>
                  {drafts.map((draft) => (
                    <li key={draft.typeId} className={styles.summaryItem}>
                      <span>{typeById.get(draft.typeId)?.label ?? 'Aktivität'}</span>
                      <span className={styles.summaryWhen}>{describe(draft)}</span>
                    </li>
                  ))}
                </ul>
                <h2 className={styles.subtitle}>Danach geht's so weiter</h2>
              </>
            )}
            <ol className={styles.hints}>
              <li className={styles.hint}>
                <span className={styles.hintMark}>{NAV.edit.icon}</span>
                <span>
                  <strong className={styles.hintTitle}>Plan anlegen (optional)</strong>
                  Für Trainings mit Struktur, etwa Kraft: unter {NAV.edit.label} mit „+ Plan“ einen
                  Plan anlegen und Blöcke mit Übungen, Sätzen und Wiederholungen füllen. Laufen oder
                  Bouldern kommen auch ohne Plan aus.
                </span>
              </li>
              <li className={styles.hint}>
                <span className={styles.hintMark}>{NAV.calendar.icon}</span>
                <span>
                  <strong className={styles.hintTitle}>Einplanen</strong>
                  Im {NAV.calendar.label} einen Tag antippen, um einmalig etwas einzuplanen oder
                  eine Serie anzulegen. Serien sind mit ↻ markiert; beim Verschieben oder Löschen
                  fragt die App, ob nur dieser Termin oder alle künftigen gemeint sind.
                </span>
              </li>
              <li className={styles.hint}>
                <span className={styles.hintMark}>{NAV.log.icon}</span>
                <span>
                  <strong className={styles.hintTitle}>Trainieren und eintragen</strong>
                  Unter {NAV.log.label} steht das aktuelle Training. Hat es noch keinen Plan,
                  ordnest du hier einen zu. Einen Satz antippen und den Wert eintragen — bei kg und
                  Band auf Wunsch auch die Wiederholungen. Der Wert vom letzten Mal steht daneben,
                  und der erste Eintrag hakt das Training ab.
                </span>
              </li>
              <li className={styles.hint}>
                <span className={styles.hintMark}>{NAV.stats.icon}</span>
                <span>
                  <strong className={styles.hintTitle}>Fortschritt sehen</strong>
                  Unter {NAV.stats.label} siehst du je Übung den Verlauf und deine Rekorde, und je
                  Woche, wie viel vom Geplanten erledigt ist.
                </span>
              </li>
            </ol>
            <p className={styles.text}>
              Diese Einführung findest du jederzeit wieder im Konto-Menü.
            </p>
          </>
        )}
      </div>

      <div className={styles.footer}>
        {!isLast ? (
          <button
            type="button"
            className={styles.solid}
            onClick={() => setStepIndex(stepIndex + 1)}
            disabled={!canContinue}
          >
            Weiter
          </button>
        ) : tourOnly ? (
          <button type="button" className={styles.solid} onClick={onSkip}>
            Fertig
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
            onClick={() => (stepIndex === 0 ? onSkip() : setStepIndex(stepIndex - 1))}
          >
            {stepIndex === 0 ? (tourOnly ? 'Schliessen' : 'Überspringen') : 'Zurück'}
          </button>
          {stepIndex > 0 && !(tourOnly && isLast) && (
            <button type="button" className={styles.link} onClick={onSkip}>
              Überspringen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
