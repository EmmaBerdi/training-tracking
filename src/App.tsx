import { useEffect, useState } from 'react';
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
import { EmptyTraining } from './components/EmptyTraining/EmptyTraining';
import { Onboarding } from './components/Onboarding/Onboarding';
import { Toast } from './components/Toast/Toast';
import { AuthScreen } from './components/AuthScreen/AuthScreen';
import { PlainSession } from './components/PlainSession/PlainSession';
import type { SheetState } from './components/Sheet/sheetState';
import { useTrainingState } from './hooks/useTrainingState';
import { usePlannedSessions } from './hooks/usePlannedSessions';
import { useToast } from './hooks/useToast';
import { useAuth } from './auth/useAuth';
import type { TabItem } from './components/Tabs/Tabs';
import type { ExerciseType, Mode, PlannedSession, Side } from './types';
import {
  addMonths,
  formatMonthLabel,
  formatTabDate,
  isSameMonth,
  monthRange,
  today,
} from './utils/date';
import { isOnboarded, markOnboarded } from './utils/onboarding';
import { plansForType, sortByType } from './state/planOps';
import { startsWorkout } from './state/logOps';

export function App() {
  const { status, user, logout } = useAuth();

  if (status === 'loading') return null;
  if (status === 'anonymous') return <AuthScreen />;

  return <TrainingApp userEmail={user?.email ?? ''} onLogout={logout} />;
}

function TrainingApp({ userEmail, onLogout }: { userEmail: string; onLogout: () => void }) {
  const toast = useToast();
  const sessions = usePlannedSessions(toast.show);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [view, setView] = useState<'training' | 'calendar'>('training');
  const [month, setMonth] = useState(() => new Date());
  const [mode, setMode] = useState<Mode>('log');
  /** Log mode follows the calendar: which scheduled session the training view is showing. */
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  /** Edit mode follows the plan list instead, since an unscheduled plan still needs editing. */
  const [editDayId, setEditDayId] = useState('');
  const [introDone, setIntroDone] = useState(false);
  const [introForced, setIntroForced] = useState(false);

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
  const introOpen =
    introForced || (t.ready && sessions.ready && empty && !introDone && !isOnboarded(userEmail));

  const closeIntro = () => {
    markOnboarded(userEmail);
    setIntroDone(true);
    setIntroForced(false);
  };

  useEffect(() => {
    const { from, to } = monthRange(month);
    setVisibleRange(from, to);
  }, [month, setVisibleRange]);

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
  const logValue = (exId: string, side: Side, index: number, value: string) => {
    const session = mode === 'log' ? activeSession : undefined;
    if (session?.status === 'planned' && startsWorkout(t.log, value)) {
      void sessions.markStatus(session.id, 'done');
    }
    t.setVal(exId, side, index, value);
  };

  const openEntry = (exId: string, side: Side, index: number, name: string, exType: ExerciseType) =>
    setSheet({ type: 'entry', exId, side, index, name, exType });

  const exerciseActions = {
    addExercise: t.addExercise,
    deleteExercise: t.deleteExercise,
    moveExercise: t.moveExercise,
    setUni: t.setExerciseUni,
    setType: t.setExerciseType,
    setText: t.setExerciseText,
    setSets: t.setExerciseSets,
    setImage: t.setExerciseImage,
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

  const closeSheet = () => setSheet(null);

  return (
    <>
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
        userEmail={userEmail}
        onReopenIntro={() => setIntroForced(true)}
        onLogout={onLogout}
      />

      <main>
        {view === 'calendar' ? (
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
            onOpenInfo={(exId) => setSheet({ type: 'info', exId })}
            onOpenEntry={openEntry}
            actions={exerciseActions}
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
      />

      {sheet && (
        <Sheet onClose={closeSheet}>
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
              onSubmit={(value) => {
                logValue(sheet.exId, sheet.side, sheet.index, value);
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
        </Sheet>
      )}

      {introOpen && (
        <Onboarding
          types={sessions.types}
          startDate={currentDate}
          onAddType={sessions.addSessionType}
          onFinish={async (rules) => {
            await sessions.addRules(rules);
            closeIntro();
            setView('calendar');
          }}
          onSkip={closeIntro}
        />
      )}

      <Toast message={toast.message} />
    </>
  );
}
