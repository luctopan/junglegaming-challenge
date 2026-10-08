import { Navigate, useLocation } from 'react-router';
import { Backdrop } from '../../app/Backdrop';
import { requestMatch, ROUTES, useAppNavigate } from '../../app/navigation';
import { Panel } from '../../components/Panel';
import { lastResultStore, usePersistedValue } from '../../state/settings';
import { ResultPanel } from './ResultPanel';
import appStyles from '../../app/App.module.css';

/**
 * `/result` opened directly (e.g. a refresh on the result screen): the last
 * completed match, read back from local storage.
 */
export function ResultScreen() {
  const result = usePersistedValue(lastResultStore);
  const navigate = useAppNavigate();
  const { search } = useLocation();
  if (result === null) return <Navigate to={{ pathname: ROUTES.menu, search }} replace />;
  return (
    <div className={appStyles.shell}>
      <Backdrop />
      <main className={appStyles.screen}>
        <Panel aria-labelledby="result-title">
          <ResultPanel
            result={result}
            submission={{ kind: 'local' }}
            headingId="result-title"
            onPlayAgain={() => {
              requestMatch();
              navigate(ROUTES.play, { replace: true });
            }}
            onMainMenu={() => {
              navigate(ROUTES.menu);
            }}
          />
        </Panel>
      </main>
    </div>
  );
}
