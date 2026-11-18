import type { NewRecurringRule, RecurringRule, RuleUpdate } from '../types';
import { request } from './base';

/**
 * Creates a repeating slot. The occurrences it generates arrive through the normal planned-session
 * range fetch, so callers create a rule and then reload the visible range.
 */
export function createRecurringRule(input: NewRecurringRule): Promise<RecurringRule | null> {
  return request<RecurringRule>('/recurring-rules', { method: 'POST', body: input });
}

/** The full series behind an occurrence — what the edit form needs, and the calendar never does. */
export function loadRecurringRule(id: number): Promise<RecurringRule | null> {
  return request<RecurringRule>(`/recurring-rules/${id}`);
}

/**
 * Redefines a series from `input.from` onwards (default: today). Everything the occurrence-level
 * edits cannot express lives here: the rhythm itself, and which plan each date gets.
 */
export function updateRecurringRule(id: number, input: RuleUpdate): Promise<RecurringRule | null> {
  return request<RecurringRule>(`/recurring-rules/${id}`, { method: 'PUT', body: input });
}
