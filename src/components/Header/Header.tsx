import { Tabs } from '../Tabs/Tabs';
import type { TabItem } from '../Tabs/Tabs';
import { UserMenu } from '../UserMenu/UserMenu';
import styles from './Header.module.scss';

interface HeaderProps {
  monthLabel: string;
  view: 'training' | 'calendar';
  tabItems: TabItem[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  /** Only while editing plans — in log mode the strip follows the calendar, not the plan list. */
  onAddPlan?: () => void;
  userEmail: string;
  onReopenIntro: () => void;
  onLogout: () => void;
}

export function Header({
  monthLabel,
  view,
  tabItems,
  activeTabId,
  onSelectTab,
  onPrevMonth,
  onNextMonth,
  onAddPlan,
  userEmail,
  onReopenIntro,
  onLogout,
}: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.hrow}>
        <div className={styles.eyebrow}>Training</div>
        <div className={styles.datewrap}>
          {view === 'training' && <span className={styles.month}>{monthLabel}</span>}
          <UserMenu email={userEmail} onReopenIntro={onReopenIntro} onLogout={onLogout} />
        </div>
      </div>
      {view === 'training' && (
        <Tabs
          items={tabItems}
          activeId={activeTabId}
          onSelect={onSelectTab}
          onPrevMonth={onPrevMonth}
          onNextMonth={onNextMonth}
          onAddPlan={onAddPlan}
        />
      )}
    </header>
  );
}
