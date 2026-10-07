import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { DEFAULT_GAME_CONFIG } from '../config/defaults';
import type { GameConfig } from '../config/gameConfig';
import { damageStage, IDLE_INPUT } from '../game/core';
import type { InputSource } from '../game/runtime';
import { createGameStore } from '../game/bridge/gameStore';
import { skilledBotInput } from '../game/core/testing/skilledBot';
import type { GameSession } from '../game/runtime';
import { createGameSession } from '../game/runtime';
import { realClock } from '../platform/clock';
import { attachCollisionOverlay } from './collisionOverlay';
import { ScaledClock } from './scaledClock';

/**
 * Dev-server-only render sandbox (`/sandbox.html`): a full match rendered with
 * Pixi where the skilled test bot steers the player. Query params set the
 * initial state, which makes screenshots reproducible:
 *   seed=<int> speed=<0..8> stopAt=<sim seconds> pauseOnExplosion=1 pauseOnFight=1 overlay=1 sound=1
 *   spawn=<x,y,headingDeg> (player start) pilot=forward (sail straight, no bot) ui=0 (no toolbar)
 * Never part of the production build (not a Vite input; nothing imports src/dev).
 */

const params = new URLSearchParams(window.location.search);
const numberParam = (name: string, fallback: number): number => {
  const value = Number(params.get(name));
  return params.has(name) && Number.isFinite(value) ? value : fallback;
};
const SPEEDS = [0, 0.25, 0.5, 1, 2, 4, 8];

/** Default config, optionally with the player spawn from `spawn=x,y,headingDeg`. */
function sandboxConfig(): GameConfig {
  const [x, y, headingDeg] = (params.get('spawn') ?? '').split(',').map(Number);
  if (x === undefined || y === undefined || headingDeg === undefined) return DEFAULT_GAME_CONFIG;
  if (![x, y, headingDeg].every(Number.isFinite)) return DEFAULT_GAME_CONFIG;
  return { ...DEFAULT_GAME_CONFIG, playerSpawn: { x, y, headingDeg } };
}

const SANDBOX_CONFIG = sandboxConfig();
const PILOT: InputSource =
  params.get('pilot') === 'forward'
    ? { sample: () => ({ ...IDLE_INPUT, forward: true }) }
    : { sample: (world) => skilledBotInput(world) };
const SHOW_UI = params.get('ui') !== '0';
/** Pausing this long after a destruction catches the explosion mid-animation. */
const EXPLOSION_PAUSE_DELAY = 0.15;
/** `pauseOnFight`: a busy frame for screenshots (burning ships, balls in flight). */
const FIGHT = { burningShips: 2, projectiles: 2, enemies: 2 } as const;

interface SandboxState {
  readonly time: number;
  readonly paused: boolean;
  readonly score: number;
  readonly enemies: number;
  readonly projectiles: number;
  readonly damagedShips: number;
  /** Alive ships at damage stage ≥ 1 (drawn with fire). */
  readonly burningShips: number;
  readonly effects: number;
  readonly phase: string;
}

declare global {
  interface Window {
    __SANDBOX__?: { state(): SandboxState | null };
  }
}

export function Sandbox() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [store] = useState(createGameStore);
  const [clock] = useState(() => new ScaledClock(realClock, numberParam('speed', 1)));
  const [seed, setSeed] = useState(() => numberParam('seed', 1));
  const [speed, setSpeed] = useState(() => clock.speed);
  const [overlay, setOverlay] = useState(params.get('overlay') === '1');
  const [sound, setSound] = useState(params.get('sound') === '1');
  const sessionRef = useRef<GameSession | null>(null);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;
    const session = createGameSession({
      container,
      store,
      config: SANDBOX_CONFIG,
      seed,
      assetBasePath: `${import.meta.env.BASE_URL}assets/`,
      input: PILOT,
      clock,
      muted: true,
    });
    sessionRef.current = session;

    const stopAt = numberParam('stopAt', Number.POSITIVE_INFINITY);
    const pauseOnExplosion = params.get('pauseOnExplosion') === '1';
    const pauseOnFight = params.get('pauseOnFight') === '1';
    let state: SandboxState | null = null;
    const offFrame = session.onFrame((world) => {
      const enemies = world.ships.filter((s) => s.team === 'enemy');
      const sinking = enemies.some(
        (s) => !s.alive && world.cfg.damage.wreckSeconds - s.wreckTimeLeft >= EXPLOSION_PAUSE_DELAY,
      );
      const next: SandboxState = {
        time: world.elapsedSeconds,
        paused: clock.speed === 0,
        score: world.score,
        enemies: enemies.filter((s) => s.alive).length,
        projectiles: world.projectiles.length,
        damagedShips: world.ships.filter((s) => s.alive && s.hp < s.maxHp).length,
        burningShips: world.ships.filter(
          (s) => s.alive && damageStage(s.hp, s.maxHp, world.cfg.damage.stageThresholds) >= 1,
        ).length,
        effects: session.stats()?.effects ?? 0,
        phase: world.phase,
      };
      const fight =
        next.burningShips >= FIGHT.burningShips &&
        next.projectiles >= FIGHT.projectiles &&
        next.enemies >= FIGHT.enemies;
      if (
        clock.speed > 0 &&
        (world.elapsedSeconds >= stopAt || (pauseOnExplosion && sinking) || (pauseOnFight && fight))
      ) {
        clock.setSpeed(0);
        setSpeed(0);
      }
      state = { ...next, paused: clock.speed === 0 };
    });
    window.__SANDBOX__ = { state: () => state };
    return () => {
      offFrame();
      sessionRef.current = null;
      session.destroy();
    };
  }, [store, clock, seed]);

  useEffect(() => {
    sessionRef.current?.setMuted(!sound);
  }, [sound, seed]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!overlay || session === null) return;
    let drawing: ReturnType<typeof attachCollisionOverlay> | null = null;
    const offFrame = session.onFrame((world) => {
      const layer = session.overlay;
      if (layer === null) return;
      drawing ??= attachCollisionOverlay(layer);
      drawing.draw(world);
    });
    return () => {
      offFrame();
      drawing?.destroy();
    };
  }, [overlay, seed]);

  const match = snapshot.match;
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0b2a3c', color: '#fdf6e3' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      {SHOW_UI && (
        <form
          aria-label="Sandbox controls"
          onSubmit={(e) => {
            e.preventDefault();
          }}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            padding: '6px 10px',
            borderRadius: 8,
            background: 'rgb(0 0 0 / 55%)',
            font: '13px system-ui, sans-serif',
          }}
        >
          <label>
            Seed{' '}
            <input
              type="number"
              value={seed}
              onChange={(e) => {
                setSeed(Number(e.target.value) || 0);
              }}
              style={{ width: 70 }}
            />
          </label>
          <label>
            Speed{' '}
            <select
              value={speed}
              onChange={(e) => {
                const next = Number(e.target.value);
                clock.setSpeed(next);
                setSpeed(next);
              }}
            >
              {SPEEDS.map((s) => (
                <option key={s} value={s}>
                  {s === 0 ? 'paused' : `${s}×`}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={() => sessionRef.current?.restart(seed)}>
            Restart
          </button>
          <label>
            <input
              type="checkbox"
              checked={overlay}
              onChange={(e) => {
                setOverlay(e.target.checked);
              }}
            />{' '}
            Collision
          </label>
          <label>
            <input
              type="checkbox"
              checked={sound}
              onChange={(e) => {
                setSound(e.target.checked);
              }}
            />{' '}
            Sound
          </label>
          <output aria-live="off">
            {snapshot.assets.kind === 'loading'
              ? `loading ${snapshot.assets.percent}%`
              : match === null
                ? snapshot.phase
                : `⏱ ${match.secondsLeft}s · ★ ${match.score} · ♥ ${match.hp}/${match.maxHp}${
                    match.endReason ? ` · ${match.endReason}` : ''
                  }`}
          </output>
        </form>
      )}
    </div>
  );
}
