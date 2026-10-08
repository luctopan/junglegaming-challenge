import { useApi } from '../../../api/apiContext';
import { useSubmissionStatus } from '../../../api/hooks';
import type { SubmissionStatus as Status } from '../../../api/submissions';
import { assertNever } from '../../../shared/assertNever';
import styles from './SubmissionStatus.module.css';

function message(status: Status): string {
  switch (status) {
    case 'saving':
      return 'Saving your battle to the ranking…';
    case 'saved':
      return 'Saved to the ranking and your match history.';
    case 'pending':
      return 'Not saved yet: it will be sent again automatically.';
    case 'failed':
      return 'Could not save your battle.';
    default:
      return assertNever(status);
  }
}

/**
 * Polite status line of the match record (announced when it changes), with
 * Retry while it is not saved. Never blocks Play again: the record waits in
 * the persisted queue whatever happens here.
 */
export function SubmissionStatus({ matchId }: { readonly matchId: string }) {
  const { submissions } = useApi();
  // Unknown and not queued: confirmed earlier (e.g. before a refresh).
  const status = useSubmissionStatus(matchId) ?? 'saved';
  const canRetry = status === 'pending' || status === 'failed';
  return (
    <div className={styles.status}>
      <p role="status" className={styles[status]} data-testid="submission-status">
        {message(status)}
      </p>
      {canRetry ? (
        <button
          type="button"
          className={styles.retry}
          onClick={() => {
            submissions.retry(matchId);
          }}
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
