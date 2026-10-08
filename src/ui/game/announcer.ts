import type { HpTone, PauseReason, SessionPhase } from '../../game/bridge/gameStore';
import { spokenDuration } from './formatClock';

/** What the live region follows (all low-frequency bridge values). */
export interface AnnouncerInput {
  readonly phase: SessionPhase;
  readonly pauseReason: PauseReason | null;
  readonly score: number;
  readonly secondsLeft: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly hpTone: HpTone;
}

export interface Announcement {
  readonly text: string;
  /**
   * `score` messages are coalesced (at most one per second, the latest
   * value wins); everything else is read at once.
   */
  readonly kind: 'immediate' | 'score';
}

/** Time left is read at every 30 s mark and once at 10 s left. */
export const TIME_MARK_SECONDS = 30;
export const FINAL_WARNING_SECONDS = 10;

const PAUSED: Readonly<Record<PauseReason, string>> = {
  manual: 'Paused.',
  blur: 'Paused: the game window lost focus.',
  hidden: 'Paused: the game tab was hidden.',
  portrait: 'Paused: turn your device to landscape to play.',
};

const TONE_ORDER: Readonly<Record<HpTone, number>> = { green: 0, amber: 1, red: 2 };

const hull = (input: AnnouncerInput): string => `hull ${input.hp} of ${input.maxHp}`;

/** Crossed a time mark going from `before` to `after` seconds left (a 1 Hz value). */
function timeMark(before: number, after: number): number | null {
  if (after >= before) return null;
  if (after <= FINAL_WARNING_SECONDS && before > FINAL_WARNING_SECONDS)
    return FINAL_WARNING_SECONDS;
  const mark = Math.floor(before / TIME_MARK_SECONDS) * TIME_MARK_SECONDS;
  if (mark === before) return null;
  return after <= mark && mark > 0 ? mark : null;
}

/**
 * Messages for the polite live region when the match snapshot changes. The
 * snapshot changes about once per second, so this never runs per frame; it
 * announces state changes, score, time marks and hull damage bands, never
 * the timer every second.
 */
export function announcementsFor(
  previous: AnnouncerInput | null,
  next: AnnouncerInput,
): Announcement[] {
  const out: Announcement[] = [];
  const say = (text: string, kind: Announcement['kind'] = 'immediate'): void => {
    out.push({ text, kind });
  };

  if (previous?.phase !== next.phase) {
    switch (next.phase) {
      case 'loading':
        break;
      case 'running':
        say(
          previous?.phase === 'paused'
            ? 'Resumed.'
            : `Battle started: ${spokenDuration(next.secondsLeft)}, ${hull(next)}.`,
        );
        break;
      case 'paused':
        say(PAUSED[next.pauseReason ?? 'manual']);
        break;
      case 'ended':
        say(`Battle complete: ${next.score} ${next.score === 1 ? 'point' : 'points'}.`);
        break;
    }
    return out;
  }
  if (next.phase !== 'running') return out;

  if (next.score > previous.score) say(`Score ${next.score}.`, 'score');
  const mark = timeMark(previous.secondsLeft, next.secondsLeft);
  if (mark !== null) say(`${spokenDuration(mark)} left.`);
  if (TONE_ORDER[next.hpTone] > TONE_ORDER[previous.hpTone]) {
    say(`${next.hpTone === 'red' ? 'Hull critical' : 'Hull damaged'}: ${hull(next)}.`);
  }
  return out;
}
