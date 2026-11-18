/** `data-tour` values: the elements the tour can point at. */
export const TOUR_TARGET = {
  log: 'nav-log',
  edit: 'nav-edit',
  calendar: 'nav-calendar',
  stats: 'nav-stats',
  tabs: 'tabs',
  sets: 'sets',
  account: 'account',
} as const;

export type TourTarget = (typeof TOUR_TARGET)[keyof typeof TOUR_TARGET];
