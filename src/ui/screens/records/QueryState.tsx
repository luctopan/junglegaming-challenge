import type { ReactNode } from 'react';
import type { RecordsQuery } from '../../records/useRecordsQuery';
import styles from './Records.module.css';

const SKELETON_ROWS = 5;

interface QueryStateProps<T> {
  readonly query: RecordsQuery<T>;
  /** "the ranking", "your match history" */
  readonly what: string;
  readonly isEmpty: (data: T) => boolean;
  readonly empty: ReactNode;
  readonly children: (data: T) => ReactNode;
}

/** Loading, error (with Retry), empty and loaded states of a records list. */
export function QueryState<T>({ query, what, isEmpty, empty, children }: QueryStateProps<T>) {
  if (query.status === 'pending') {
    return (
      <div className={styles.state} aria-busy="true">
        <p role="status" className={styles.stateText}>
          Loading {what}…
        </p>
        <div aria-hidden="true" className={styles.skeleton}>
          {Array.from({ length: SKELETON_ROWS }, (_, row) => (
            <span key={row} className={styles.skeletonRow} />
          ))}
        </div>
      </div>
    );
  }
  if (query.status === 'error') {
    return (
      <div className={styles.state} role="alert">
        <p className={`${styles.stateText} ${styles.error}`}>
          Could not load {what}. Check your connection and try again.
        </p>
        <button type="button" className={styles.retry} onClick={query.refetch}>
          Retry
        </button>
      </div>
    );
  }
  if (isEmpty(query.data)) {
    return (
      <div className={styles.state}>
        <p role="status" className={styles.stateText}>
          {empty}
        </p>
      </div>
    );
  }
  return <>{children(query.data)}</>;
}
