import { useEffect, useRef } from 'react';
import type { GameSnapshot } from '../../game/bridge/gameStore';
import type { AnnouncerInput } from './announcer';
import { announcementsFor } from './announcer';

/** Score messages are coalesced: at most one per this many ms, with the latest score. */
const SCORE_DEBOUNCE_MS = 1000;

const toInput = (snapshot: GameSnapshot): AnnouncerInput | null =>
  snapshot.match === null || snapshot.phase === 'loading'
    ? null
    : {
        phase: snapshot.phase,
        pauseReason: snapshot.pauseReason,
        score: snapshot.match.score,
        secondsLeft: snapshot.match.secondsLeft,
        hp: snapshot.match.hp,
        maxHp: snapshot.match.maxHp,
        hpTone: snapshot.match.hpTone,
      };

/**
 * Polite live region with the match state for screen readers (the HUD shows
 * the same values visually). It follows the bridge snapshot, which changes
 * about once per second, and writes the region's text directly, so it never
 * re-renders React; what it says is decided by `announcementsFor`.
 */
export function MatchAnnouncer({ snapshot }: { readonly snapshot: GameSnapshot }) {
  const regionRef = useRef<HTMLParagraphElement>(null);
  const previousRef = useRef<AnnouncerInput | null>(null);
  const scoreTimerRef = useRef<number | null>(null);
  const pendingScoreRef = useRef<string | null>(null);

  useEffect(() => {
    const next = toInput(snapshot);
    if (next === null) return;
    const region = regionRef.current;
    const announcements = announcementsFor(previousRef.current, next);
    previousRef.current = next;
    if (region === null) return;

    const immediate = announcements.filter((a) => a.kind === 'immediate').map((a) => a.text);
    if (immediate.length > 0) region.textContent = immediate.join(' ');

    const score = announcements.find((a) => a.kind === 'score');
    if (score === undefined) return;
    pendingScoreRef.current = score.text;
    if (scoreTimerRef.current !== null) return;
    region.textContent = score.text;
    pendingScoreRef.current = null;
    scoreTimerRef.current = window.setTimeout(() => {
      scoreTimerRef.current = null;
      const pending = pendingScoreRef.current;
      pendingScoreRef.current = null;
      if (pending !== null && regionRef.current !== null) regionRef.current.textContent = pending;
    }, SCORE_DEBOUNCE_MS);
  }, [snapshot]);

  useEffect(
    () => () => {
      if (scoreTimerRef.current !== null) window.clearTimeout(scoreTimerRef.current);
    },
    [],
  );

  return (
    <p
      ref={regionRef}
      className="visually-hidden"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="match-announcer"
    />
  );
}
