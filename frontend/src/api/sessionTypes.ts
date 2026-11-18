import type { SessionType } from '../types';
import { request, requestOk } from './base';

export function loadSessionTypes(): Promise<SessionType[] | null> {
  return request<SessionType[]>('/session-types');
}

export function createSessionType(input: {
  label: string;
  color?: string;
  icon?: string;
}): Promise<SessionType | null> {
  return request<SessionType>('/session-types', { method: 'POST', body: input });
}

export function deleteSessionType(id: number): Promise<boolean> {
  return requestOk(`/session-types/${id}`, { method: 'DELETE' });
}
