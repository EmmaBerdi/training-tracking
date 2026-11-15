import type { Block, BlockKind, Day, Exercise, ExerciseType, Plan, SessionType } from '../types';
import { BLOCK_KIND_LABEL, UNIT } from '../data/constants';
import { uid } from '../data/plan';

/** A plan day as written in the import file: no id yet, and its activity named rather than numbered. */
export interface ImportedDay {
  short: string;
  title: string;
  /** The activity label from the file; matched against the account's session types by the user. */
  sessionType?: string;
  blocks: Block[];
}

export interface ImportedPlan {
  warmup: string[];
  days: ImportedDay[];
}

export type ImportResult = { ok: true; plan: ImportedPlan } | { ok: false; errors: string[] };

// Column widths from the schema, so a plan that passes here is never rejected by the save.
const MAX_SHORT = 32;
const MAX_TEXT = 255;
const MAX_REPS = 64;
const MAX_SETS = 99;

type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Reads a plan written in the documented import format and checks every field the app relies on.
 * Keys it does not know (such as a free-text `schedule`) are ignored. All problems are collected,
 * so one round of fixes is enough rather than one per error.
 */
export function parsePlanImport(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['Kein gültiges JSON.'] };
  }
  if (!isObject(data)) return { ok: false, errors: ['Erwartet wird ein Objekt mit "days".'] };

  const errors: string[] = [];

  const str = (v: unknown, where: string, max: number, required = true): string | undefined => {
    if (v === undefined || v === null || v === '') {
      if (required) errors.push(`${where}: fehlt.`);
      return undefined;
    }
    if (typeof v !== 'string') {
      errors.push(`${where}: muss Text sein.`);
      return undefined;
    }
    const trimmed = v.trim();
    if (required && !trimmed) errors.push(`${where}: fehlt.`);
    else if (trimmed.length > max) errors.push(`${where}: höchstens ${max} Zeichen.`);
    return trimmed || undefined;
  };

  const sets = (v: unknown, where: string): number => {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > MAX_SETS) {
      errors.push(`${where}: ganze Zahl von 0 bis ${MAX_SETS} erwartet.`);
      return 0;
    }
    return v;
  };

  const exercise = (raw: unknown, where: string): Exercise | null => {
    if (!isObject(raw)) {
      errors.push(`${where}: muss ein Objekt sein.`);
      return null;
    }
    const name = str(raw.name, `${where} name`, MAX_TEXT) ?? '';
    const label = name ? `${where} („${name}“)` : where;
    const type = raw.type as ExerciseType;
    if (!(typeof type === 'string' && type in UNIT)) {
      errors.push(`${label} type: einer von ${Object.keys(UNIT).join(', ')}.`);
    }
    // Plans written by hand or by another tool often give a plain rep count as a number.
    const reps = str(
      typeof raw.reps === 'number' ? String(raw.reps) : raw.reps,
      `${label} reps`,
      MAX_REPS,
    );
    const note = str(raw.note, `${label} note`, Infinity, false);
    const desc = str(raw.desc, `${label} desc`, Infinity, false);
    const base = { id: uid(), name, type, reps: reps ?? '', note, desc };
    if (raw.uni === true) {
      return {
        ...base,
        uni: true,
        setsL: sets(raw.setsL, `${label} setsL`),
        setsR: sets(raw.setsR, `${label} setsR`),
      };
    }
    if (raw.uni !== undefined && raw.uni !== false) errors.push(`${label} uni: true oder false.`);
    return { ...base, uni: false, sets: sets(raw.sets, `${label} sets`) };
  };

  const block = (raw: unknown, where: string): Block | null => {
    if (!isObject(raw)) {
      errors.push(`${where}: muss ein Objekt sein.`);
      return null;
    }
    const kind = raw.kind as BlockKind;
    if (!(typeof kind === 'string' && kind in BLOCK_KIND_LABEL)) {
      errors.push(`${where} kind: einer von ${Object.keys(BLOCK_KIND_LABEL).join(', ')}.`);
    }
    const name = str(raw.name, `${where} name`, MAX_TEXT) ?? '';
    if (!Array.isArray(raw.ex)) {
      errors.push(`${where} ex: Liste von Übungen erwartet.`);
      return null;
    }
    const ex = raw.ex
      .map((x, i) => exercise(x, `${where}, Übung ${i + 1}`))
      .filter((x): x is Exercise => x !== null);
    return { kind, name, ex };
  };

  const day = (raw: unknown, where: string): ImportedDay | null => {
    if (!isObject(raw)) {
      errors.push(`${where}: muss ein Objekt sein.`);
      return null;
    }
    const title = str(raw.title, `${where} title`, MAX_TEXT) ?? '';
    const label = title ? `${where} („${title}“)` : where;
    const short = str(raw.short, `${label} short`, MAX_SHORT) ?? '';
    const sessionType = str(raw.sessionType, `${label} sessionType`, MAX_TEXT, false);
    if (!Array.isArray(raw.blocks)) {
      errors.push(`${label} blocks: Liste von Blöcken erwartet.`);
      return null;
    }
    const blocks = raw.blocks
      .map((b, i) => block(b, `${label}, Block ${i + 1}`))
      .filter((b): b is Block => b !== null);
    return { short, title, sessionType, blocks };
  };

  let warmup: string[] = [];
  if (data.warmup !== undefined) {
    if (Array.isArray(data.warmup)) {
      warmup = data.warmup
        .map((w, i) => str(w, `warmup ${i + 1}`, Infinity))
        .filter((w): w is string => w !== undefined);
    } else {
      errors.push('warmup: Liste von Texten erwartet.');
    }
  }

  let days: ImportedDay[] = [];
  if (Array.isArray(data.days) && data.days.length > 0) {
    days = data.days
      .map((d, i) => day(d, `Tag ${i + 1}`))
      .filter((d): d is ImportedDay => d !== null);
  } else {
    errors.push('days: mindestens ein Tag erwartet.');
  }

  return errors.length ? { ok: false, errors } : { ok: true, plan: { warmup, days } };
}

/** The distinct activity labels the file names, in first-seen order; '' stands for "not given". */
export function importedTypeLabels(plan: ImportedPlan): string[] {
  return [...new Set(plan.days.map((d) => d.sessionType ?? ''))];
}

/** The session type a label names, ignoring case and surrounding space; never a guess beyond that. */
export function matchSessionType(label: string, types: SessionType[]): SessionType | undefined {
  const wanted = label.trim().toLowerCase();
  return wanted ? types.find((t) => t.label.trim().toLowerCase() === wanted) : undefined;
}

/** The imported days as plan days, each bound to the session type chosen for its label. */
export function toDays(imported: ImportedPlan, typeFor: Record<string, number>): Day[] {
  return imported.days.map(({ sessionType, ...d }) => ({
    ...d,
    id: uid(),
    sessionTypeId: typeFor[sessionType ?? ''],
  }));
}

/**
 * Appends the days to the plan. The warmup list is shared by every day, so only items not already
 * on it are added.
 */
export function mergeImport(plan: Plan, days: Day[], warmup: string[]): Plan {
  const known = new Set(plan.warmup.map((w) => w.trim().toLowerCase()));
  const merged = [...plan.warmup];
  for (const item of warmup) {
    const key = item.toLowerCase();
    if (known.has(key)) continue;
    known.add(key);
    merged.push(item);
  }
  return { warmup: merged, days: [...plan.days, ...days] };
}
