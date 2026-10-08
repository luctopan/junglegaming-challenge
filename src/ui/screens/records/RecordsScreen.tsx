import type { KeyboardEvent } from 'react';
import { useRef } from 'react';
import { Navigate, useLocation, useParams } from 'react-router';
import type { RecordsTab } from '../../app/navigation';
import { recordsPath, ROUTES, useAppNavigate } from '../../app/navigation';
import { Button } from '../../components/Button';
import { Panel } from '../../components/Panel';
import screen from '../screen.module.css';
import { HistoryPanel } from './HistoryPanel';
import { RankingPanel } from './RankingPanel';
import styles from './RecordsScreen.module.css';

const TABS: readonly { readonly id: RecordsTab; readonly label: string }[] = [
  { id: 'ranking', label: 'Ranking' },
  { id: 'history', label: 'Match history' },
];

const isTab = (value: string | undefined): value is RecordsTab =>
  value === 'ranking' || value === 'history';

const tabId = (tab: RecordsTab): string => `records-tab-${tab}`;
const panelId = (tab: RecordsTab): string => `records-panel-${tab}`;

/**
 * Captain's Log (assets/sample_ranking.png, sample_history.png): Ranking and
 * Match History as ARIA tabs (arrow keys, Home/End, automatic activation).
 * The URL (`/records/:tab`) follows the selected tab without adding history
 * entries, so the tab survives a refresh and is linkable.
 */
export function RecordsScreen() {
  const { tab } = useParams();
  const { search } = useLocation();
  const navigate = useAppNavigate();
  const tabRefs = useRef<Partial<Record<RecordsTab, HTMLButtonElement | null>>>({});

  if (!isTab(tab)) return <Navigate to={{ pathname: ROUTES.ranking, search }} replace />;

  const select = (next: RecordsTab, focus: boolean): void => {
    navigate(recordsPath(next), { replace: true });
    if (focus) tabRefs.current[next]?.focus();
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const index = TABS.findIndex((t) => t.id === tab);
    const last = TABS.length - 1;
    const target: Record<string, number> = {
      ArrowRight: index === last ? 0 : index + 1,
      ArrowLeft: index === 0 ? last : index - 1,
      Home: 0,
      End: last,
    };
    const next = TABS[target[event.key] ?? -1];
    if (next === undefined) return;
    event.preventDefault();
    select(next.id, true);
  };

  return (
    <Panel size="wide" aria-labelledby="records-title" className={styles.panel}>
      <h2 id="records-title" className={screen.heading}>
        Captain&apos;s log
      </h2>
      <div role="tablist" aria-label="Captain's log" className={styles.tabs}>
        {TABS.map(({ id, label }) => {
          const selected = id === tab;
          return (
            <Button
              key={id}
              ref={(element) => {
                tabRefs.current[id] = element;
              }}
              id={tabId(id)}
              role="tab"
              aria-selected={selected}
              aria-controls={panelId(id)}
              tabIndex={selected ? 0 : -1}
              variant={selected ? 'primary' : 'secondary'}
              size="small"
              onClick={() => {
                select(id, false);
              }}
              onKeyDown={onTabKeyDown}
            >
              {label}
            </Button>
          );
        })}
      </div>
      <div
        id={panelId(tab)}
        role="tabpanel"
        aria-labelledby={tabId(tab)}
        className={styles.tabpanel}
      >
        {tab === 'ranking' ? <RankingPanel /> : <HistoryPanel />}
      </div>
      <Button
        onClick={() => {
          navigate(ROUTES.menu);
        }}
      >
        Main menu
      </Button>
    </Panel>
  );
}
