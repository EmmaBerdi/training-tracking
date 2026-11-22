import type { IntervalTimer, IntervalTimerInput } from '../types';
import { request, requestOk } from './base';

export function loadTimers(): Promise<IntervalTimer[] | null> {
  return request<IntervalTimer[]>('/timers');
}

export function createTimer(input: IntervalTimerInput): Promise<IntervalTimer | null> {
  return request<IntervalTimer>('/timers', { method: 'POST', body: input });
}

export function updateTimer(id: number, input: IntervalTimerInput): Promise<IntervalTimer | null> {
  return request<IntervalTimer>(`/timers/${id}`, { method: 'PUT', body: input });
}

export function deleteTimer(id: number): Promise<boolean> {
  return requestOk(`/timers/${id}`, { method: 'DELETE' });
}
