import { assertNever } from '../../../shared/assertNever';
import styles from './SubmissionStatus.module.css';

/**
 * Where the match record stands. Phase 4 only stores the result on this
 * device (`local`); the online states come with the API layer (Phase 5),
 * which feeds this same component.
 */
export type SubmissionState =
  | { readonly kind: 'local' }
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved' }
  | { readonly kind: 'pending' }
  | { readonly kind: 'failed'; readonly retry: () => void };

function message(state: SubmissionState): string {
  switch (state.kind) {
    case 'local':
      return 'Result saved on this device.';
    case 'saving':
      return 'Saving your battle to the ranking…';
    case 'saved':
      return 'Saved to the ranking and your match history.';
    case 'pending':
      return 'Not saved yet: it will be sent again automatically.';
    case 'failed':
      return 'Could not save your battle.';
    default:
      return assertNever(state);
  }
}

/** Polite status line (announced when it changes), with Retry when saving failed. */
export function SubmissionStatus({ state }: { readonly state: SubmissionState }) {
  return (
    <div className={styles.status}>
      <p role="status" className={styles[state.kind]} data-testid="submission-status">
        {message(state)}
      </p>
      {state.kind === 'failed' ? (
        <button type="button" className={styles.retry} onClick={state.retry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
