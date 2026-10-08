import { describe, expect, it } from 'vitest';
import type { AnnouncerInput } from './announcer';
import { announcementsFor } from './announcer';

const running: AnnouncerInput = {
  phase: 'running',
  pauseReason: null,
  score: 0,
  secondsLeft: 120,
  hp: 200,
  maxHp: 200,
  hpTone: 'green',
};

const texts = (previous: AnnouncerInput | null, next: AnnouncerInput) =>
  announcementsFor(previous, next).map((a) => a.text);

describe('announcementsFor', () => {
  it('announces the start, pauses, resume and the end', () => {
    expect(texts(null, running)).toEqual(['Battle started: 2 minutes, hull 200 of 200.']);
    const paused = { ...running, phase: 'paused', pauseReason: 'hidden' } as const;
    expect(texts(running, paused)).toEqual(['Paused: the game tab was hidden.']);
    expect(texts(paused, running)).toEqual(['Resumed.']);
    expect(texts(running, { ...running, phase: 'ended', score: 1 })).toEqual([
      'Battle complete: 1 point.',
    ]);
  });

  it('never reads the timer every second', () => {
    for (let s = 119; s > 90; s--) {
      expect(texts({ ...running, secondsLeft: s + 1 }, { ...running, secondsLeft: s })).toEqual([]);
    }
  });

  it('reads time at 30 s marks and once at 10 s left', () => {
    expect(texts({ ...running, secondsLeft: 91 }, { ...running, secondsLeft: 90 })).toEqual([
      '1 minute 30 seconds left.',
    ]);
    expect(texts({ ...running, secondsLeft: 31 }, { ...running, secondsLeft: 30 })).toEqual([
      '30 seconds left.',
    ]);
    expect(texts({ ...running, secondsLeft: 11 }, { ...running, secondsLeft: 10 })).toEqual([
      '10 seconds left.',
    ]);
    expect(texts({ ...running, secondsLeft: 10 }, { ...running, secondsLeft: 9 })).toEqual([]);
    // A jump over a mark (e.g. a slow frame) still announces it once.
    expect(texts({ ...running, secondsLeft: 62 }, { ...running, secondsLeft: 59 })).toEqual([
      '1 minute left.',
    ]);
  });

  it('marks score changes for coalescing and reads hull damage bands', () => {
    expect(announcementsFor(running, { ...running, score: 2 })).toEqual([
      { text: 'Score 2.', kind: 'score' },
    ]);
    expect(texts(running, { ...running, hp: 90, hpTone: 'amber' })).toEqual([
      'Hull damaged: hull 90 of 200.',
    ]);
    const amber = { ...running, hp: 90, hpTone: 'amber' } as const;
    expect(texts(amber, { ...amber, hp: 40, hpTone: 'red' })).toEqual([
      'Hull critical: hull 40 of 200.',
    ]);
    // HP points alone are not announced (the HUD shows them).
    expect(texts(running, { ...running, hp: 180 })).toEqual([]);
  });

  it('stays quiet while paused or ended', () => {
    const paused = { ...running, phase: 'paused', pauseReason: 'manual' } as const;
    expect(texts(paused, { ...paused, secondsLeft: 90, score: 3 })).toEqual([]);
  });
});
