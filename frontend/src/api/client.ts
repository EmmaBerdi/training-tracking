import type { AppState } from '../types';
import { request, requestOk } from './base';

export function loadState(): Promise<AppState | null> {
  return request<AppState>('/state');
}

export function saveState(data: AppState): Promise<boolean> {
  return requestOk('/state', { method: 'PUT', body: data });
}
