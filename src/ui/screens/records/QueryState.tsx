import type { ReactNode } from 'react';
import styles from './Records.module.css';

const SKELETON_ROWS = 5;

/** The part of a TanStack Query result the records lists use. */
export interface QueryView<T> {
  readonly status: 'pending' | 'error' | 'success';
  readonly data: T | undefined;
  readonly isFetching: boolean;
  readonly refetch: () => unknown;
}

interface QueryStateProps<T> {
  readonly query: QueryView<T>;
  /** "the ranking", "your match history" */
  readonly what: string;
  readonly isEmpty: (data: T) => boolean;
  readonly empty: ReactNode;
  readonly children: (data: T) => ReactNode;
}

/**
 * Loading, error (with Retry), empty and loaded states of a records list.
 * When a background refresh fails, the cached rows stay with a notice.
 */
export function QueryState<T>({ query, what, isEmpty, empty, children }: QueryStateProps<T>) {
  const { data } = query;
  const retry = (
    <button
      type="button"
      className={styles.retry}
      onClick={() => {
        void query.refetch();
      }}
    >
      Retry
    </button>
  );
  if (data === undefined && query.status === 'error') {
    return (
      <div className={styles.state} role="alert">
        <p className={`${styles.stateText} ${styles.error}`}>
          Could not load {what}. Check your connection and try again.
        </p>
        {retry}
      </div>
    );
  }
  if (data === undefined) {
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
  const stale =
    query.status === 'error' && !query.isFetching ? (
      <div className={styles.staleNotice} role="alert">
        <p className={styles.error}>Could not refresh {what}; showing saved data.</p>
        {retry}
      </div>
    ) : null;
  if (isEmpty(data)) {
    return (
      <>
        {stale}
        <div className={styles.state}>
          <p role="status" className={styles.stateText}>
            {empty}
          </p>
        </div>
      </>
    );
  }
  return (
    <>
      {stale}
      {children(data)}
    </>
  );
}
