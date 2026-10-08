import { useMutation, useQuery } from '@tanstack/react-query';
import { useId } from 'react';
import { useApi } from '../../api/apiContext';
import { usePendingCount } from '../../api/hooks';
import type { MockStatus, ScenarioName } from '../../api/scenarios';
import { isScenarioName, SCENARIO_DESCRIPTIONS, SCENARIOS } from '../../api/scenarios';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import screen from '../screens/screen.module.css';
import { lastResultStore } from '../state/settings';
import styles from './MockPanel.module.css';

const MOCK_STATUS_KEY = ['mock', 'status'] as const;

/**
 * Dev panel of the mock backend (`?dev=1`, or the footer link of the main
 * menu): network scenario, recovery of `unavailable-then-recover`, the
 * pending queue, and Reset. Available in the published demo on purpose.
 */
export function MockPanel({ onClose }: { readonly onClose: () => void }) {
  const id = useId();
  const { client, queryClient, queue, submissions } = useApi();
  const pending = usePendingCount();
  const status = useQuery({
    queryKey: MOCK_STATUS_KEY,
    queryFn: () => client.mock.status(),
    retry: false,
  });

  const applied = (next: MockStatus): void => {
    queryClient.setQueryData(MOCK_STATUS_KEY, next);
  };
  const choose = useMutation({
    mutationFn: (scenario: ScenarioName) => client.mock.setScenario(scenario),
    onSuccess: async (next) => {
      applied(next);
      // Lists cached under the previous scenario would be misleading.
      await queryClient.resetQueries({ predicate: (q) => q.queryKey[0] !== 'mock' });
    },
  });
  const recover = useMutation({
    mutationFn: () => client.mock.recover(),
    onSuccess: async (next) => {
      applied(next);
      await submissions.flush();
    },
  });
  const reset = useMutation({
    mutationFn: () => client.mock.reset(),
    onSuccess: (next) => {
      queue.clear();
      lastResultStore.set(null);
      submissions.reset();
      // A fresh cache: the server revision guard can never hold back new data.
      queryClient.clear();
      applied(next);
    },
  });
  const busy = choose.isPending || recover.isPending || reset.isPending;
  const failed = [status, choose, recover, reset].some((action) => action.isError);
  const scenario = status.data?.scenario;

  return (
    <Dialog labelledBy={`${id}-title`} onEscape={onClose} size="wide">
      <h2 id={`${id}-title`} className={screen.heading}>
        Mock backend
      </h2>
      <p className={`${screen.text} ${screen.small}`}>
        Every request is served by Mock Service Worker in this browser. Pick a network scenario to
        see how the game copes.
      </p>
      <div className={styles.field}>
        <label htmlFor={`${id}-scenario`} className={screen.caps}>
          Scenario
        </label>
        <select
          id={`${id}-scenario`}
          className={styles.select}
          value={scenario ?? ''}
          disabled={scenario === undefined || busy}
          aria-describedby={`${id}-description`}
          onChange={(event) => {
            if (isScenarioName(event.target.value)) choose.mutate(event.target.value);
          }}
        >
          {scenario === undefined ? <option value="">Loading…</option> : null}
          {SCENARIOS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <p id={`${id}-description`} className={`${screen.text} ${screen.small} ${screen.muted}`}>
          {scenario === undefined ? '' : SCENARIO_DESCRIPTIONS[scenario]}
        </p>
      </div>
      <p role="status" className={`${screen.text} ${screen.small}`} data-testid="mock-status">
        {status.data === undefined
          ? 'Reading the mock backend…'
          : `${status.data.records} saved ${status.data.records === 1 ? 'match' : 'matches'} · ${pending} pending`}
        {scenario === 'unavailable-then-recover' && status.data?.recovered === true
          ? ' · recovered'
          : ''}
      </p>
      {failed ? (
        <p role="alert" className={`${screen.text} ${screen.small} ${styles.error}`}>
          The mock backend did not answer.
        </p>
      ) : null}
      <div className={screen.row}>
        {scenario === 'unavailable-then-recover' ? (
          <Button
            size="small"
            variant="secondary"
            disabled={busy}
            onClick={() => {
              recover.mutate();
            }}
          >
            Recover
          </Button>
        ) : null}
        <Button
          size="small"
          variant="secondary"
          disabled={busy || pending === 0}
          onClick={() => {
            void submissions.flush();
          }}
        >
          Send pending
        </Button>
        <Button
          size="small"
          variant="secondary"
          disabled={busy}
          onClick={() => {
            reset.mutate();
          }}
        >
          Reset
        </Button>
        <Button size="small" onClick={onClose}>
          Close
        </Button>
      </div>
    </Dialog>
  );
}
