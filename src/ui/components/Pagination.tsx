import { RoundButton } from './RoundButton';
import styles from './Pagination.module.css';

interface PaginationProps {
  readonly page: number;
  readonly totalPages: number;
  /** What is paged, for the buttons' names ("ranking", "match history"). */
  readonly label: string;
  readonly onChange: (page: number) => void;
  readonly busy?: boolean;
}

/** `PAGE 1 OF 3` between round arrow buttons (assets/sample_ranking.png). */
export function Pagination({ page, totalPages, label, onChange, busy = false }: PaginationProps) {
  return (
    <nav className={styles.pagination} aria-label={`${label} pages`}>
      <RoundButton
        label={`Previous ${label} page`}
        icon={{ atlas: 'turn_left' }}
        size="small"
        disabled={page <= 1}
        onClick={() => {
          onChange(page - 1);
        }}
      />
      <p className={styles.label} aria-live="polite" aria-busy={busy}>
        Page {page} of {totalPages}
      </p>
      <RoundButton
        label={`Next ${label} page`}
        icon={{ atlas: 'turn_right' }}
        size="small"
        disabled={page >= totalPages}
        onClick={() => {
          onChange(page + 1);
        }}
      />
    </nav>
  );
}
