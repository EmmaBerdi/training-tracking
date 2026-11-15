import { useState } from 'react';
import type { SessionType } from '../../types';
import {
  importedTypeLabels,
  matchSessionType,
  parsePlanImport,
  type ImportedPlan,
} from '../../state/planImport';
import { defaultSessionTypeColor, sessionTypeAccent } from '../../utils/cssVar';
import styles from './ImportPlanSheet.module.scss';

interface ImportPlanSheetProps {
  types: SessionType[];
  onAddType: (input: { label: string; color?: string }) => Promise<SessionType | null>;
  /** `typeFor` maps each activity label of the file ('' = none given) to the chosen session type. */
  onImport: (plan: ImportedPlan, typeFor: Record<string, number>) => void;
}

export function ImportPlanSheet({ types, onAddType, onImport }: ImportPlanSheetProps) {
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [plan, setPlan] = useState<ImportedPlan | null>(null);
  const [typeFor, setTypeFor] = useState<Record<string, number>>({});
  const [creating, setCreating] = useState(false);

  const labels = plan ? importedTypeLabels(plan) : [];
  const complete = labels.every((l) => typeFor[l] != null);

  const handleCheck = () => {
    const result = parsePlanImport(text);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors([]);
    setPlan(result.plan);
    // Only exact label matches are preselected; anything else is left for the user to decide.
    const matched: Record<string, number> = {};
    for (const label of importedTypeLabels(result.plan)) {
      const type = matchSessionType(label, types);
      if (type) matched[label] = type.id;
    }
    setTypeFor(matched);
  };

  const handleCreateType = async (label: string) => {
    setCreating(true);
    const created = await onAddType({ label, color: defaultSessionTypeColor() });
    setCreating(false);
    if (created) setTypeFor((prev) => ({ ...prev, [label]: created.id }));
  };

  if (!plan) {
    return (
      <>
        <h2 className={styles.title}>Plan importieren</h2>
        <div className={styles.sub}>
          JSON im Import-Format einfügen. Die Pläne werden zu den bestehenden hinzugefügt.
        </div>

        <div className={styles.field}>
          <label htmlFor="import-json">JSON</label>
          <textarea
            id="import-json"
            className={styles.json}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='{ "warmup": [...], "days": [...] }'
            spellCheck={false}
            rows={10}
          />
        </div>

        {errors.length > 0 && (
          <ul className={styles.error}>
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}

        <button
          type="button"
          className={styles.solid}
          onClick={handleCheck}
          disabled={!text.trim()}
        >
          Prüfen
        </button>
      </>
    );
  }

  return (
    <>
      <h2 className={styles.title}>Plan importieren</h2>
      <div className={styles.sub}>
        {plan.days.length === 1 ? '1 Plan' : `${plan.days.length} Pläne`}
        {plan.warmup.length > 0 && `, ${plan.warmup.length} Aufwärmpunkte`} gefunden.
      </div>

      <ul className={styles.days}>
        {plan.days.map((d, i) => (
          <li key={i}>
            <strong>{d.short}</strong> · {d.title}
            <span className={styles.count}>
              {d.blocks.reduce((n, b) => n + b.ex.length, 0)} Übungen
            </span>
          </li>
        ))}
      </ul>

      {labels.map((label) => (
        <div key={label} className={styles.field}>
          <label>{label ? `Aktivität für „${label}“` : 'Aktivität (nicht angegeben)'}</label>
          <div className={styles.chips}>
            {types.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`${styles.chip} ${t.id === typeFor[label] ? styles.chipOn : ''}`}
                style={sessionTypeAccent(t)}
                aria-pressed={t.id === typeFor[label]}
                onClick={() => setTypeFor((prev) => ({ ...prev, [label]: t.id }))}
              >
                {t.label}
              </button>
            ))}
            {label && !matchSessionType(label, types) && (
              <button
                type="button"
                className={styles.chip}
                disabled={creating}
                onClick={() => void handleCreateType(label)}
              >
                + „{label}“ anlegen
              </button>
            )}
          </div>
        </div>
      ))}

      <button
        type="button"
        className={styles.solid}
        onClick={() => onImport(plan, typeFor)}
        disabled={!complete}
      >
        {plan.days.length === 1 ? 'Plan importieren' : `${plan.days.length} Pläne importieren`}
      </button>
      <button type="button" className={styles.ghost} onClick={() => setPlan(null)}>
        Zurück zum JSON
      </button>
    </>
  );
}
