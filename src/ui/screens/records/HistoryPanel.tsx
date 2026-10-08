import { useState } from 'react';
import type { MatchRecord, Page } from '../../../api/contracts';
import { useHistoryPage } from '../../../api/hooks';
import { Pagination } from '../../components/Pagination';
import { formatDuration, spokenDuration } from '../../game/formatClock';
import { formatPlayedAt } from '../../records/format';
import { lastResultStore, profileStore, usePersistedValue } from '../../state/settings';
import { END_REASON_LABEL } from '../result/endReason';
import { QueryState } from './QueryState';
import styles from './Records.module.css';

const MS_PER_SECOND = 1000;

/** The player's own battles, newest first; the latest one is highlighted. */
export function HistoryPanel() {
  const profile = usePersistedValue(profileStore);
  const lastResult = usePersistedValue(lastResultStore);
  const [page, setPage] = useState(1);
  const playerId = profile?.playerId ?? null;

  const history = useHistoryPage(playerId, page);

  return (
    <>
      <p className={styles.subtitle}>
        {profile === null ? 'Your recent battles' : `${profile.name} · Your recent battles`}
      </p>
      {playerId === null ? (
        <p role="status" className={styles.stateText}>
          No battles yet. Finish a battle and it will be logged here.
        </p>
      ) : (
        <QueryState
          query={history}
          what="your match history"
          isEmpty={(data: Page<MatchRecord>) => data.totalItems === 0}
          empty="No battles yet. Finish a battle and it will be logged here."
        >
          {(data) => (
            <>
              <table className={styles.table} aria-busy={history.isFetching}>
                <caption className="visually-hidden">
                  Your match history, page {data.page} of {data.totalPages}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Points</th>
                    <th scope="col">Duration</th>
                    <th scope="col">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((record) => {
                    const played = formatPlayedAt(record.playedAt);
                    const latest = record.matchId === lastResult?.matchId;
                    return (
                      <tr key={record.matchId} className={latest ? styles.highlight : undefined}>
                        <th scope="row" className={styles.date}>
                          <span aria-hidden="true">
                            {played.date} <small>· {played.time}</small>
                          </span>
                          <span className="visually-hidden">{played.spoken}</span>
                        </th>
                        <td className={styles.points}>{record.score}</td>
                        <td>
                          <span aria-hidden="true">{formatDuration(record.durationMs)}</span>
                          <span className="visually-hidden">
                            {spokenDuration(Math.floor(record.durationMs / MS_PER_SECOND))}
                          </span>
                        </td>
                        <td
                          className={
                            record.endReason === 'defeated' ? styles.defeated : styles.timeUp
                          }
                        >
                          {END_REASON_LABEL[record.endReason]}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Pagination
                page={page}
                totalPages={data.totalPages}
                label="match history"
                busy={history.isFetching}
                onChange={setPage}
              />
            </>
          )}
        </QueryState>
      )}
    </>
  );
}
