import { useId, useMemo, useState } from 'react';
import type { ConfigKey, Page, RankingEntry } from '../../../api/contracts';
import { configKeyOf, parseConfigKey } from '../../../api/contracts';
import { useRankedConfigs, useRankingPage } from '../../../api/hooks';
import { AtlasIcon } from '../../components/Icon';
import { Pagination } from '../../components/Pagination';
import { describeConfig, formatPlayedAt, rankLabel } from '../../records/format';
import { optionsStore, profileStore, usePersistedValue } from '../../state/settings';
import { QueryState } from './QueryState';
import styles from './Records.module.css';

const byConfig = (a: ConfigKey, b: ConfigKey): number => {
  const x = parseConfigKey(a);
  const y = parseConfigKey(b);
  if (x === null || y === null) return a.localeCompare(b);
  return x.sessionSeconds - y.sessionSeconds || x.spawnIntervalSeconds - y.spawnIntervalSeconds;
};

/**
 * Ranking of one config (matches are only compared with the same settings),
 * defaulting to the player's current Options; the subtitle is a selector of
 * the configs that have records. The player's rows carry a `YOU` badge,
 * matched by `playerId`, never by name.
 */
export function RankingPanel() {
  const id = useId();
  const options = usePersistedValue(optionsStore);
  const profile = usePersistedValue(profileStore);
  const [configKey, setConfigKey] = useState<ConfigKey>(() => configKeyOf(options));
  const [page, setPage] = useState(1);

  const configs = useRankedConfigs();
  const ranking = useRankingPage(configKey, page);

  const choices = useMemo(() => {
    const keys = new Set<ConfigKey>([configKeyOf(options), configKey]);
    for (const c of configs.data ?? []) keys.add(c.configKey);
    return [...keys].sort(byConfig);
  }, [configs.data, options, configKey]);

  const selected = parseConfigKey(configKey);
  return (
    <>
      <div className={styles.subtitle}>
        <label htmlFor={`${id}-config`} className="visually-hidden">
          Battle settings of the ranking
        </label>
        <select
          id={`${id}-config`}
          className={styles.select}
          value={configKey}
          onChange={(event) => {
            setConfigKey(event.target.value as ConfigKey);
            setPage(1);
          }}
        >
          {choices.map((key) => {
            const config = parseConfigKey(key);
            return (
              <option key={key} value={key}>
                {config === null ? key : describeConfig(config)}
              </option>
            );
          })}
        </select>
      </div>
      <QueryState
        query={ranking}
        what="the ranking"
        isEmpty={(data: Page<RankingEntry>) => data.totalItems === 0}
        empty="No battles recorded with these settings yet. Be the first!"
      >
        {(data) => (
          <>
            <table className={styles.table} aria-busy={ranking.isFetching}>
              <caption className="visually-hidden">
                Ranking, {selected === null ? configKey : describeConfig(selected)}, page{' '}
                {data.page} of {data.totalPages}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Captain</th>
                  <th scope="col">Points</th>
                  <th scope="col">Played</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((entry) => {
                  const mine = profile !== null && entry.playerId === profile.playerId;
                  const played = formatPlayedAt(entry.playedAt);
                  return (
                    <tr key={entry.matchId} className={mine ? styles.highlight : undefined}>
                      <td className={styles.rank}>{rankLabel(entry.rank)}</td>
                      <th scope="row" className={styles.captain}>
                        {entry.rank === 1 ? (
                          <AtlasIcon name="score" className={styles.star} />
                        ) : null}
                        <span>{entry.playerName}</span>
                        {mine ? (
                          <span className={styles.badge}>
                            <span aria-hidden="true">You</span>
                            <span className="visually-hidden">(you)</span>
                          </span>
                        ) : null}
                      </th>
                      <td className={styles.points}>{entry.score}</td>
                      <td className={styles.when}>
                        <span aria-hidden="true">
                          {played.date} · {played.time}
                        </span>
                        <span className="visually-hidden">{played.spoken}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination
              page={page}
              totalPages={data.totalPages}
              label="ranking"
              busy={ranking.isFetching}
              onChange={setPage}
            />
          </>
        )}
      </QueryState>
    </>
  );
}
