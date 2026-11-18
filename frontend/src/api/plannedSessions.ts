import type { EditScope, PlannedSession, PlannedSessionStatus, Rotation } from '../types';
import { NO_CONTENT, request, requestOk, type NoContent } from './base';

/**
 * A scope=future write answers 204: the change applied to every later occurrence of the series, so
 * there is no single session to return and the caller has to reload the visible range.
 */
export const SERIES_CHANGED = NO_CONTENT;
export type SeriesChanged = NoContent;

/** The most days one load may span; inside `PlannedSessionService.MAX_RANGE_DAYS` on the backend. */
export const MAX_LOAD_DAYS = 365;

export function loadPlannedSessions(from: string, to: string): Promise<PlannedSession[] | null> {
  const query = new URLSearchParams({ from, to });
  return request<PlannedSession[]>(`/planned-sessions?${query}`);
}

export function createPlannedSession(input: {
  date: string;
  time?: string;
  sessionTypeId: number;
  dayId?: string;
  notes?: string;
}): Promise<PlannedSession | null> {
  return request<PlannedSession>('/planned-sessions', { method: 'POST', body: input });
}

export function updatePlannedSession(
  id: number,
  patch: { sessionTypeId: number; dayId?: string; notes?: string; scope?: EditScope },
): Promise<PlannedSession | SeriesChanged | null> {
  return request<PlannedSession | SeriesChanged>(`/planned-sessions/${id}`, {
    method: 'PUT',
    body: patch,
  });
}

export function reschedulePlannedSession(
  id: number,
  patch: { date: string; time?: string; scope?: EditScope },
): Promise<PlannedSession | SeriesChanged | null> {
  return request<PlannedSession | SeriesChanged>(`/planned-sessions/${id}/schedule`, {
    method: 'PUT',
    body: patch,
  });
}

/** `rotation: 'shift'` on a skip answers 204: the rest of the rotation moved along with it. */
export function updatePlannedSessionStatus(
  id: number,
  status: PlannedSessionStatus,
  rotation?: Rotation,
): Promise<PlannedSession | SeriesChanged | null> {
  return request<PlannedSession | SeriesChanged>(`/planned-sessions/${id}/status`, {
    method: 'PUT',
    body: { status, rotation },
  });
}

export function deletePlannedSession(
  id: number,
  scope?: EditScope,
  rotation?: Rotation,
): Promise<boolean> {
  const params = new URLSearchParams();
  if (scope) params.set('scope', scope);
  if (rotation) params.set('rotation', rotation);
  const query = params.size > 0 ? `?${params}` : '';
  return requestOk(`/planned-sessions/${id}${query}`, { method: 'DELETE' });
}
