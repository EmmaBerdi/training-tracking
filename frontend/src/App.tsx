import { useEffect, useRef, useState } from 'react';
import { Header } from './components/Header/Header';
import { Footer } from './components/Footer/Footer';
import { DayView } from './components/DayView/DayView';
import { CalendarView } from './components/CalendarView/CalendarView';
import { Sheet } from './components/Sheet/Sheet';
import { InfoSheet } from './components/InfoSheet/InfoSheet';
import { EntrySheet } from './components/EntrySheet/EntrySheet';
import { AddSessionSheet } from './components/AddSessionSheet/AddSessionSheet';
import { SessionDetailSheet } from './components/SessionDetailSheet/SessionDetailSheet';
import { PlanSheet } from './components/PlanSheet/PlanSheet';
import { ImportPlanSheet } from './components/ImportPlanSheet/ImportPlanSheet';
import { ChangePasswordSheet } from './components/ChangePasswordSheet/ChangePasswordSheet';
import { AdminUsersSheet } from './components/AdminUsersSheet/AdminUsersSheet';
import { WhatsNewSheet } from './components/WhatsNewSheet/WhatsNewSheet';
import { EmptyTraining } from './components/EmptyTraining/EmptyTraining';
import { Onboarding } from './components/Onboarding/Onboarding';
import { Tour, type TourStep } from './components/Tour/Tour';
import { TOUR_TARGET } from './components/Tour/targets';
import { Toast } from './components/Toast/Toast';
import { AuthScreen } from './components/AuthScreen/AuthScreen';
import { PlainSession } from './components/PlainSession/PlainSession';
import { StatsView } from './components/StatsView/StatsView';
import { TimersSheet } from './components/TimersSheet/TimersSheet';
import { TimerRun } from './components/TimerRun/TimerRun';
import type { SheetState } from './components/Sheet/sheetState';
import type { TimerActions } from './components/actions';
import { useTrainingState } from './hooks/useTrainingState';
import { usePlannedSessions } from './hooks/usePlannedSessions';
import { useTimers } from './hooks/useTimers';
import { useToast } from './hooks/useToast';
import { useAuth } from './auth/useAuth';
import type { TabItem } from './components/Tabs/Tabs';
import type { ExerciseType, IntervalTimer, Mode, PlannedSession, Side, View } from './types';
import {
  addMonths,
  formatMonthLabel,
  formatTabDate,
  isSameMonth,
  monthRange,
  today,
} from './utils/date';
import { isOnboarded, markOnboarded } from './utils/onboarding';
import { readInviteToken } from './utils/inviteLink';
import {
  currentVersion,
  lastSeenVersion,
  loadReleases,
  markSeen,
  recentReleases,
  unseenReleases,
} from './utils/whatsNew';
import {
  currentStep,
  exerciseReps,
  intervalRounds,
  plansForType,
  sortByType,
  timerUses,
} from './state/planOps';
import { toDays } from './state/planImport';
import { startsWorkout } from './state/logOps';
import { NAV } from './data/constants';

export function App() {
  const { status, user, logout } = useAuth();
  const [inviteToken, setInviteToken] = useState(() => readInviteToken(window.location.hash));

  // Out of the address bar at once, so the one-time link isn't kept in history or a bookmark.
  useEffect(() => {
    if (readInviteToken(window.location.hash)) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  // Ahead of any session in this browser: accepting replaces it with the invited account.
  if (inviteToken) {
    return <AuthScreen inviteToken={inviteToken} onInviteDone={() => setInviteToken(null)} />;
  }
  if (status === 'loading') return null;
  if (status === 'anonymous') return <AuthScreen />;

  return (
    <TrainingApp userEmail={user?.email ?? ''} admin={user?.admin ?? false} onLogout={logout} />
  );
}

function TrainingApp({
  userEmail,
  admin,
  onLogout,
}: {
  userEmail: string;
  admin: boolean;
  onLogout: (notice?: string) => void;
}) {
  const toast = useToast();
  const sessions = usePlannedSessions(toast.show);
  const timers = useTimers(toast.show);
  const [sheet, setSheet] = useState<SheetState>(null);
  /**
   * The timer on screen, if one is running. `sessionId` is the planned session a finished run ticks
   * off, like a first logged value does; a test run from the timer page has none.
   */
  const [timerRun, setTimerRun] = useState<{
    timer: IntervalTimer;
    rounds: number;
    title: string;
    sessionId?: number;
  } | null>(null);
  const [view, setView] = useState<View>('training');
  const [month, setMonth] = useState(() => new Date());
  const [mode, setMode] = useState<Mode>('log');
  /** Log mode follows the calendar: which scheduled session the training view is showing. */
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  /** Edit mode follows the plan list instead, since an unscheduled plan still needs editing. */
  const [editDayId, setEditDayId] = useState('');
  const [introDone, setIntroDone] = useState(false);
  /** Set once the introduction is asked for or under way; null leaves it to the first-run rule. */
  const [introStage, setIntroStage] = useState<'welcome' | 'tour' | null>(null);

  const currentDate = today();
  const { setVisibleRange } = sessions;

  // Only the sessions of the month on screen, in the order they happen.
  const monthSessions = sessions.sessions
    .filter((s) => isSameMonth(s.date, month))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''));

  // Nothing picked yet: today's session, else the next one coming up, else the last one.
  const activeSession: PlannedSession | undefined =
    monthSessions.find((s) => s.id === selectedSessionId) ??
    monthSessions.find((s) => s.date === currentDate) ??
    monthSessions.find((s) => s.date > currentDate) ??
    monthSessions[monthSessions.length - 1];

  const t = useTrainingState(
    toast.show,
    mode === 'edit'
      ? { date: currentDate, dayId: editDayId }
      : { date: activeSession?.date ?? currentDate, dayId: activeSession?.dayId ?? '' },
  );

  // A brand-new account has nothing to look at, so the introduction opens by itself — once.
  const empty = t.plan.days.length === 0 && sessions.sessions.length === 0;
  const firstRun = t.ready && sessions.ready && empty && !introDone && !isOnboarded(userEmail);
  const intro = introStage ?? (firstRun ? 'welcome' : null);

  const closeIntro = () => {
    markOnboarded(userEmail);
    // A new account starts out current: the news is about changes it never knew the old way.
    const version = currentVersion();
    if (version) markSeen(userEmail, version);
    setIntroDone(true);
    setIntroStage(null);
  };

  useEffect(() => {
    const { from, to } = monthRange(month);
    setVisibleRange(from, to);
  }, [month, setVisibleRange]);

  // Once per app start, after the introduction if there is one: the releases not seen yet.
  const whatsNewChecked = useRef(false);
  const appReady = t.ready && sessions.ready;
  useEffect(() => {
    const version = currentVersion();
    if (!appReady || intro !== null || !version || whatsNewChecked.current) return;
    whatsNewChecked.current = true;
    void loadReleases().then((releases) => {
      const unseen = unseenReleases(releases, lastSeenVersion(userEmail), version);
      markSeen(userEmail, version);
      if (unseen.length) setSheet((s) => s ?? { type: 'whatsNew', releases: unseen });
    });
  }, [appReady, intro, userEmail]);

  const openWhatsNew = () =>
    void loadReleases().then((releases) =>
      setSheet({ type: 'whatsNew', releases: recentReleases(releases, currentVersion()) }),
    );

  if (!t.ready) return null;

  const typeById = new Map(sessions.types.map((ty) => [ty.id, ty]));

  const tabItems: TabItem[] =
    mode === 'edit'
      ? sortByType(t.plan.days, sessions.types).map((d) => ({
          id: d.id,
          top: d.short,
          bottom: d.title,
          accent: typeById.get(d.sessionTypeId)?.color,
        }))
      : monthSessions.map((s) => {
          const type = typeById.get(s.sessionTypeId);
          const day = t.plan.days.find((d) => d.id === s.dayId);
          return {
            id: String(s.id),
            top: formatTabDate(s.date),
            bottom: day?.title ?? type?.label ?? '',
            accent: type?.color,
            dim: s.status !== 'planned',
          };
        });

  const handleSelectTab = (id: string) => {
    if (mode === 'edit') setEditDayId(id);
    else setSelectedSessionId(Number(id));
    t.setOpen(null);
  };

  const handleModeChange = (next: Mode) => {
    // Entering edit mode: start on the plan the selected day uses, if it has one.
    if (next === 'edit' && !editDayId) setEditDayId(t.dayId || t.plan.days[0]?.id || '');
    setMode(next);
    setView('training');
    t.setOpen(null);
  };

  const openTraining = (session: PlannedSession) => {
    setSelectedSessionId(session.id);
    setMode('log');
    setView('training');
  };

  /**
   * Logging a value also ticks the session off — on the workout's first entry only, and only while
   * it is still "geplant", so a manual "übersprungen" or a deliberate reset is never overridden.
   */
  const logValue = (exId: string, side: Side, index: number, value: string, reps: string) => {
    const session = mode === 'log' ? activeSession : undefined;
    if (session?.status === 'planned' && startsWorkout(t.log, value)) {
      void sessions.markStatus(session.id, 'done');
    }
    t.setVal(exId, side, index, value, reps);
  };

  const openEntry = (exId: string, side: Side, index: number, name: string, exType: ExerciseType) =>
    setSheet({ type: 'entry', exId, side, index, name, exType });

  const exerciseActions = {
    addExercise: t.addExercise,
    deleteExercise: t.deleteExercise,
    moveExercise: t.moveExercise,
    setUni: t.setExerciseUni,
    setType: t.setExerciseType,
    setTimer: t.setExerciseTimer,
    setText: t.setExerciseText,
    setSets: t.setExerciseSets,
    addStep: t.addExerciseStep,
    setStepField: t.setExerciseStepField,
    removeStep: t.removeExerciseStep,
    setStep: t.setExerciseStep,
    addImages: t.addExerciseImages,
    removeImage: t.removeExerciseImage,
  };

  const progressActions = {
    getRating: t.getRating,
    rate: t.setRating,
    suggestNext: t.suggestNext,
    setStep: t.setExerciseStep,
  };

  const blockActions = {
    addBlock: t.addBlock,
    deleteBlock: t.deleteBlock,
    moveBlock: t.moveBlock,
    setBlockName: t.setBlockName,
    setBlockKind: t.setBlockKind,
  };

  const warmupActions = {
    addWarmupItem: t.addWarmupItem,
    deleteWarmupItem: t.deleteWarmupItem,
    moveWarmupItem: t.moveWarmupItem,
    setWarmupText: t.setWarmupText,
  };

  const timerActions: TimerActions = {
    timers: timers.timers,
    manage: (link) => setSheet({ type: 'timers', link }),
    run: (x) => {
      const timer = timers.timers.find((tm) => tm.id === x.timerId);
      if (!timer) return;
      const session = mode === 'log' ? activeSession : undefined;
      setTimerRun({
        timer,
        rounds: intervalRounds(x),
        title: x.name,
        sessionId: session?.status === 'planned' ? session.id : undefined,
      });
    },
  };

  const closeSheet = () => setSheet(null);

  // Sets are only on screen when the training the log opens on has a plan with exercises.
  const hasSets = !!t.plan.days
    .find((d) => d.id === activeSession?.dayId)
    ?.blocks.some((b) => b.ex.length > 0);
  const showLog = () => handleModeChange('log');

  const tourSteps: TourStep[] = [
    {
      target: TOUR_TARGET.log,
      title: NAV.log.label,
      text: 'Hier steht dein aktuelles Training, so wie du es im Studio vor dir hast.',
      show: showLog,
    },
    {
      target: TOUR_TARGET.tabs,
      title: 'Deine Trainings',
      text: 'Die Trainings des Monats nebeneinander. Antippen wechselt, mit ‹ und › blätterst du Monate.',
      show: showLog,
    },
    ...(hasSets
      ? [
          {
            target: TOUR_TARGET.sets,
            title: 'Sätze eintragen',
            text: 'Einen Satz antippen und den Wert eintragen. Grau steht der Wert vom letzten Mal, und der erste Eintrag hakt das Training ab.',
            show: showLog,
          },
        ]
      : []),
    {
      target: TOUR_TARGET.edit,
      title: NAV.edit.label,
      text: 'Workout-Pläne aus Blöcken und Übungen, mit Sätzen und Wiederholungen. Oben mit „+ Plan“ legst du einen an; Laufen oder Bouldern kommen auch ohne Plan aus.',
      show: () => handleModeChange('edit'),
    },
    {
      target: TOUR_TARGET.calendar,
      title: NAV.calendar.label,
      text: 'Einen Tag antippen, um ein Training einmalig oder als Serie einzuplanen. Serien tragen ein ↻.',
      show: () => setView('calendar'),
    },
    {
      target: TOUR_TARGET.stats,
      title: NAV.stats.label,
      text: 'Verlauf und Rekorde je Übung, und je Woche, wie viel vom Geplanten erledigt ist.',
      show: () => setView('stats'),
    },
    {
      target: TOUR_TARGET.account,
      title: 'Konto',
      text: 'Hier findest du diese Einführung wieder, änderst dein Passwort oder meldest dich ab.',
    },
  ];

  return (
    <div data-view={view}>
      <Header
        monthLabel={formatMonthLabel(month)}
        view={view}
        tabItems={tabItems}
        activeTabId={
          mode === 'edit' ? t.dayId || null : activeSession ? String(activeSession.id) : null
        }
        onSelectTab={handleSelectTab}
        onPrevMonth={() => setMonth(addMonths(month, -1))}
        onNextMonth={() => setMonth(addMonths(month, 1))}
        onAddPlan={mode === 'edit' ? () => setSheet({ type: 'newPlan' }) : undefined}
        onOpenTimers={mode === 'edit' ? () => setSheet({ type: 'timers' }) : undefined}
        userEmail={userEmail}
        onReopenIntro={() => setIntroStage('welcome')}
        onOpenWhatsNew={openWhatsNew}
        onChangePassword={() => setSheet({ type: 'changePassword' })}
        onManageUsers={admin ? () => setSheet({ type: 'adminUsers' }) : undefined}
        onLogout={() => onLogout()}
      />

      <main>
        {view === 'stats' ? (
          <StatsView plan={t.plan} logs={t.logs} types={sessions.types} />
        ) : view === 'calendar' ? (
          <CalendarView
            month={month}
            onMonthChange={setMonth}
            sessions={sessions.sessions}
            types={sessions.types}
            days={t.plan.days}
            onSelectDay={(date) => setSheet({ type: 'addSession', date })}
            onSelectSession={(session) => setSheet({ type: 'sessionDetail', session })}
          />
        ) : t.day ? (
          <DayView
            day={t.day}
            type={typeById.get(t.day.sessionTypeId)}
            mode={mode}
            warmup={t.plan.warmup}
            log={t.log}
            warmOpen={t.open === 'warm'}
            onToggleWarmOpen={() => t.setOpen(t.open === 'warm' ? null : 'warm')}
            onToggleWarmupItem={t.toggleWarmupItem}
            warmupActions={warmupActions}
            getVal={t.getVal}
            lastVal={t.lastVal}
            getReps={t.getReps}
            lastReps={t.lastReps}
            onOpenInfo={(exId) => setSheet({ type: 'info', exId })}
            onOpenEntry={openEntry}
            actions={exerciseActions}
            progress={progressActions}
            timerActions={timerActions}
            blockActions={blockActions}
            onEditPlan={() => t.day && setSheet({ type: 'editPlan', day: t.day })}
            onOpenSession={
              mode === 'log' && activeSession
                ? () => setSheet({ type: 'sessionDetail', session: activeSession })
                : undefined
            }
          />
        ) : activeSession && mode === 'log' ? (
          <PlainSession
            session={activeSession}
            type={typeById.get(activeSession.sessionTypeId)}
            canAttachPlan={plansForType(t.plan.days, activeSession.sessionTypeId).length > 0}
            onMarkStatus={(status) => void sessions.markStatus(activeSession.id, status)}
            onAttachPlan={() => setSheet({ type: 'sessionDetail', session: activeSession })}
          />
        ) : (
          <EmptyTraining
            hasPlans={t.plan.days.length > 0}
            monthLabel={formatMonthLabel(month)}
            onOpenCalendar={() => setView('calendar')}
            onAddPlan={() => setSheet({ type: 'newPlan' })}
          />
        )}
      </main>

      <Footer
        view={view}
        mode={mode}
        onModeChange={handleModeChange}
        onOpenCalendar={() => setView('calendar')}
        onOpenStats={() => setView('stats')}
      />

      {sheet && (
        <Sheet onClose={closeSheet} centered={sheet.type === 'whatsNew'}>
          {sheet.type === 'info' &&
            (() => {
              const exercise = t.findExercise(sheet.exId);
              return exercise ? <InfoSheet exercise={exercise} onClose={closeSheet} /> : null;
            })()}

          {sheet.type === 'entry' && (
            <EntrySheet
              key={`${sheet.exId}-${sheet.side}-${sheet.index}`}
              name={sheet.name}
              type={sheet.exType}
              side={sheet.side}
              index={sheet.index}
              current={t.getVal(sheet.exId, sheet.side, sheet.index)}
              last={t.lastVal(sheet.exId, sheet.side, sheet.index)}
              currentReps={t.getReps(sheet.exId, sheet.side, sheet.index)}
              lastReps={t.lastReps(sheet.exId, sheet.side, sheet.index)}
              planReps={(() => {
                const exercise = t.findExercise(sheet.exId);
                return exercise ? exerciseReps(exercise) : '';
              })()}
              step={(() => {
                const exercise = t.findExercise(sheet.exId);
                return exercise ? currentStep(exercise) : undefined;
              })()}
              // Index -1 reads as empty, so the first set has no previous one.
              previous={{
                value: t.getVal(sheet.exId, sheet.side, sheet.index - 1),
                reps: t.getReps(sheet.exId, sheet.side, sheet.index - 1),
              }}
              onSubmit={(value, reps) => {
                logValue(sheet.exId, sheet.side, sheet.index, value, reps);
                closeSheet();
              }}
              onClear={() => {
                t.setVal(sheet.exId, sheet.side, sheet.index, '');
                closeSheet();
              }}
            />
          )}

          {sheet.type === 'newPlan' && (
            <PlanSheet
              types={sessions.types}
              onSubmit={(input) => {
                const day = t.addDay(input);
                setEditDayId(day.id);
                setMode('edit');
                closeSheet();
              }}
              onImport={() => setSheet({ type: 'importPlan' })}
            />
          )}

          {sheet.type === 'importPlan' && (
            <ImportPlanSheet
              types={sessions.types}
              onAddType={sessions.addSessionType}
              onImport={(imported, typeFor) => {
                const days = toDays(imported, typeFor);
                t.importDays(days, imported.warmup);
                setEditDayId(days[0].id);
                setMode('edit');
                setView('training');
                closeSheet();
                toast.show(
                  days.length === 1 ? 'Plan importiert' : `${days.length} Pläne importiert`,
                );
              }}
            />
          )}

          {sheet.type === 'editPlan' && (
            <PlanSheet
              key={sheet.day.id}
              day={sheet.day}
              types={sessions.types}
              onSubmit={(input) => {
                t.updateDay(sheet.day.id, input);
                closeSheet();
              }}
              onDelete={() => {
                t.deleteDay(sheet.day.id);
                setEditDayId(t.plan.days.find((d) => d.id !== sheet.day.id)?.id ?? '');
                closeSheet();
              }}
            />
          )}

          {sheet.type === 'addSession' && (
            <AddSessionSheet
              date={sheet.date}
              types={sessions.types}
              days={t.plan.days}
              onAddType={sessions.addSessionType}
              onDeleteType={sessions.removeSessionType}
              onSubmit={async (input) => {
                if (await sessions.addSession(input)) closeSheet();
              }}
              onSubmitRule={async (input) => {
                if (await sessions.addRule(input)) closeSheet();
              }}
            />
          )}

          {sheet.type === 'sessionDetail' && (
            <SessionDetailSheet
              key={sheet.session.id}
              session={sheet.session}
              type={typeById.get(sheet.session.sessionTypeId)}
              day={t.plan.days.find((d) => d.id === sheet.session.dayId)}
              days={t.plan.days}
              onReschedule={async (date, time, scope) => {
                if (await sessions.reschedule(sheet.session.id, date, time, scope)) closeSheet();
              }}
              onChangePlan={async (dayId, scope) => {
                const updated = await sessions.updateSession(
                  sheet.session.id,
                  { sessionTypeId: sheet.session.sessionTypeId, dayId, notes: sheet.session.notes },
                  scope,
                );
                if (updated) closeSheet();
              }}
              onMarkStatus={async (status, rotation) => {
                if (await sessions.markStatus(sheet.session.id, status, rotation)) closeSheet();
              }}
              onDelete={async (scope, rotation) => {
                if (await sessions.removeSession(sheet.session.id, scope, rotation)) closeSheet();
              }}
              onStartWorkout={() => {
                openTraining(sheet.session);
                closeSheet();
              }}
              onEditSeries={
                sheet.session.ruleId == null
                  ? undefined
                  : async () => {
                      const ruleId = sheet.session.ruleId as number;
                      const rule = await sessions.loadRule(ruleId);
                      if (rule) setSheet({ type: 'editSeries', rule, from: sheet.session.date });
                    }
              }
            />
          )}

          {sheet.type === 'editSeries' && (
            <AddSessionSheet
              key={sheet.rule.id}
              date={sheet.from}
              rule={sheet.rule}
              types={sessions.types}
              days={t.plan.days}
              onAddType={sessions.addSessionType}
              onDeleteType={sessions.removeSessionType}
              onSubmitRule={async ({ startDate, ...rest }) => {
                // The sheet's "Ab" date is where the new definition takes over.
                if (await sessions.updateRule(sheet.rule.id, { ...rest, from: startDate })) {
                  closeSheet();
                }
              }}
            />
          )}

          {sheet.type === 'timers' && (
            <TimersSheet
              timers={timers.timers}
              usesOf={(timerId) => timerUses(t.plan, timerId)}
              startWithNew={!!sheet.link}
              onCreate={async (input) => {
                const created = await timers.addTimer(input);
                if (created && sheet.link) {
                  t.setExerciseTimer(sheet.link.ref, sheet.link.exId, created.id);
                  closeSheet();
                }
                return created;
              }}
              onSave={timers.saveTimer}
              onDelete={async (id) => {
                if (!(await timers.removeTimer(id))) return false;
                t.clearTimer(id);
                return true;
              }}
              onTest={(timer) => setTimerRun({ timer, rounds: 2, title: 'Test' })}
            />
          )}

          {sheet.type === 'changePassword' && (
            <ChangePasswordSheet
              onChanged={() =>
                onLogout('Passwort geändert — bitte mit dem neuen Passwort anmelden.')
              }
              onClose={closeSheet}
            />
          )}

          {sheet.type === 'adminUsers' && (
            <AdminUsersSheet currentEmail={userEmail} onError={toast.show} onClose={closeSheet} />
          )}

          {sheet.type === 'whatsNew' && (
            <WhatsNewSheet releases={sheet.releases} onClose={closeSheet} />
          )}
        </Sheet>
      )}

      {intro === 'welcome' && (
        <Onboarding
          onStartTour={() => {
            setSheet(null);
            setIntroStage('tour');
          }}
          onSkip={closeIntro}
        />
      )}

      {intro === 'tour' && (
        <Tour
          steps={tourSteps}
          onClose={() => {
            closeIntro();
            // A new account's next move is scheduling something; anyone else goes back to training.
            if (empty) setView('calendar');
            else handleModeChange('log');
          }}
        />
      )}

      {timerRun && (
        <TimerRun
          timer={timerRun.timer}
          rounds={timerRun.rounds}
          title={timerRun.title}
          onFinish={() => {
            if (timerRun.sessionId != null) void sessions.markStatus(timerRun.sessionId, 'done');
          }}
          onClose={() => setTimerRun(null)}
        />
      )}

      <Toast message={toast.message} />
    </div>
  );
}
