import type { Container } from 'pixi.js';
import type { GameConfig } from '../../config/gameConfig';
import { DisposableScope } from '../../platform/disposableScope';
import { realClock } from '../../platform/clock';
import { trackResource } from '../../platform/resourceCounters';
import type { Clock } from '../../shared/clock';
import { MS_PER_SECOND } from '../../shared/math/constants';
import type { DomainEvent, World } from '../core';
import { createFixedStepper, createMatch, getPlayer, step, timeLeftSeconds } from '../core';
import type { GameStore } from '../bridge/gameStore';
import { toPercent } from '../bridge/gameStore';
import type { AudioEngine, CombatAtlases, RenderStats, WorldView } from '../render';
import {
  createAudioEngine,
  fitViewport,
  loadCombatAssets,
  preferredTextureResolution,
  WorldRenderer,
} from '../render';
import type { InputSource } from './inputSource';
import { IDLE_INPUT_SOURCE } from './inputSource';
import type { PixiHost } from './pixiHost';
import { createPixiHost } from './pixiHost';

export interface GameSessionOptions {
  readonly container: HTMLElement;
  readonly store: GameStore;
  readonly config: GameConfig;
  readonly seed: number;
  /** URL prefix of the generated runtime assets (`public/assets/`). */
  readonly assetBasePath: string;
  readonly input?: InputSource;
  readonly clock?: Clock;
  readonly muted?: boolean;
}

export interface SessionStats extends RenderStats {
  readonly displayObjects: number;
}

export interface GameSession {
  /** Retries after an asset failure (the Retry button). */
  retryAssets(): void;
  /** Fresh match on the same canvas: new world, views back to their pools. */
  restart(seed?: number): void;
  setMuted(muted: boolean): void;
  /** Top layer in world coordinates for dev overlays; null until the arena is shown. */
  readonly overlay: Container | null;
  /** Called after every rendered frame with the current world. */
  onFrame(listener: (world: WorldView) => void): () => void;
  stats(): SessionStats | null;
  /** Idempotent and safe at any point, including while assets or Pixi still initialise. */
  destroy(): void;
}

const liveSessions = new Set<GameSession>();

/** Sessions currently alive in the page (the test hook sums their resources). */
export const activeSessions = (): readonly GameSession[] => [...liveSessions];

class SessionAbortedError extends Error {
  constructor() {
    super('Game session was destroyed');
    this.name = 'SessionAbortedError';
  }
}

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

function countDisplayObjects(root: Container): number {
  let count = 1;
  for (const child of root.children) count += countDisplayObjects(child);
  return count;
}

/**
 * Wires simulation, renderer, audio, input and the bridge store for one game
 * screen. Creation is synchronous; the async boot (assets → Pixi → match) is
 * abort-aware, so `destroy()` during any await leaves nothing behind (React
 * Strict Mode mounts, unmounts and remounts the screen in development).
 */
export function createGameSession(options: GameSessionOptions): GameSession {
  const { container, store, config, assetBasePath } = options;
  const input = options.input ?? IDLE_INPUT_SOURCE;
  const clock = options.clock ?? realClock;
  const abort = new AbortController();
  const scope = new DisposableScope();
  const frameListeners = new Set<(world: WorldView) => void>();
  const pending: DomainEvent[] = [];
  const audio: AudioEngine = createAudioEngine({
    basePath: assetBasePath,
    muted: options.muted ?? false,
  });
  scope.add(() => {
    audio.destroy();
  });

  let world: World = createMatch(config, options.seed);
  let host: PixiHost | null = null;
  let renderer: WorldRenderer | null = null;
  let lastFrameMs: number | null = null;
  let resumeRetry: (() => void) | null = null;

  const stepper = createFixedStepper({
    clock,
    stepSeconds: config.simulation.stepSeconds,
    maxFrameSeconds: config.simulation.maxFrameSeconds,
    maxStepsPerFrame: config.simulation.maxStepsPerFrame,
    onStep: () => {
      pending.push(...step(world, input.sample(world)));
    },
  });

  const publish = (): void => {
    const player = getPlayer(world);
    store.publishMatch({
      score: world.score,
      secondsLeft: Math.ceil(timeLeftSeconds(world)),
      hp: Math.ceil(player.hp),
      maxHp: player.maxHp,
      endReason: world.endReason,
    });
    store.setPhase(world.phase === 'ended' ? 'ended' : 'running');
  };

  const onTick = (): void => {
    if (renderer === null) return;
    const now = clock.now();
    const dtSeconds =
      lastFrameMs === null
        ? 0
        : Math.min(config.simulation.maxFrameSeconds, (now - lastFrameMs) / MS_PER_SECOND);
    lastFrameMs = now;
    const { alpha } = stepper.tick();
    if (pending.length > 0) {
      renderer.playEvents(pending, world);
      audio.playEvents(pending, world.playerId);
      pending.length = 0;
    }
    renderer.update(dtSeconds);
    renderer.sync(world, alpha);
    publish();
    for (const listener of frameListeners) listener(world);
  };

  const waitForRetry = (): Promise<void> =>
    new Promise((resolve, reject) => {
      if (abort.signal.aborted) {
        reject(new SessionAbortedError());
        return;
      }
      resumeRetry = resolve;
      abort.signal.addEventListener(
        'abort',
        () => {
          reject(new SessionAbortedError());
        },
        { once: true },
      );
    });

  const loadAssets = async (): Promise<CombatAtlases> => {
    const arena = { width: world.arena.width, height: world.arena.height };
    const size = { width: container.clientWidth, height: container.clientHeight };
    const resolution = preferredTextureResolution(
      window.devicePixelRatio || 1,
      fitViewport(size, arena).scale,
    );
    for (;;) {
      store.setAssets({ kind: 'loading', percent: 0 });
      try {
        const atlases = await loadCombatAssets({
          basePath: assetBasePath,
          resolution,
          onProgress: (progress) => {
            if (!abort.signal.aborted)
              store.setAssets({ kind: 'loading', percent: toPercent(progress) });
          },
        });
        if (abort.signal.aborted) throw new SessionAbortedError();
        store.setAssets({ kind: 'ready' });
        return atlases;
      } catch (error) {
        if (abort.signal.aborted) throw new SessionAbortedError();
        // Handled: shown with a Retry button; combat never starts without the art.
        console.warn('Game assets failed to load', error);
        store.setAssets({ kind: 'error', message: describe(error) });
        await waitForRetry();
      }
    }
  };

  const startMatch = (): void => {
    lastFrameMs = null;
    stepper.resetBaseline();
    pending.length = 0;
    audio.play('matchStart');
    audio.startAmbience();
    publish();
  };

  const unlockAudio = (): void => {
    audio.unlock();
  };

  const boot = async (): Promise<void> => {
    const atlases = await loadAssets();
    const pixi = await createPixiHost(
      container,
      { width: world.arena.width, height: world.arena.height },
      abort.signal,
    );
    if (pixi === null) throw new SessionAbortedError();
    host = pixi;
    renderer = new WorldRenderer(atlases, world.arena);
    pixi.app.stage.addChild(renderer.root);
    renderer.setViewport(pixi.viewport);
    pixi.onViewportChange((viewport) => renderer?.setViewport(viewport));
    pixi.app.ticker.add(onTick);
    const releaseTicker = trackResource('tickerCallbacks');
    scope.add(() => {
      pixi.app.ticker.remove(onTick);
      releaseTicker();
    });
    // Autoplay rules: sound may start only after a user gesture.
    // (`userActivation` is missing in some browsers: then the first gesture unlocks.)
    if ('userActivation' in navigator && navigator.userActivation.hasBeenActive) unlockAudio();
    scope.listen(window, 'pointerdown', unlockAudio);
    scope.listen(window, 'keydown', unlockAudio);
    startMatch();
  };

  const session: GameSession = {
    retryAssets() {
      const resume = resumeRetry;
      resumeRetry = null;
      resume?.();
    },
    restart(seed = options.seed) {
      if (abort.signal.aborted) return;
      world = createMatch(config, seed);
      renderer?.reset();
      if (renderer !== null) startMatch();
    },
    setMuted(muted) {
      audio.setMuted(muted);
    },
    get overlay() {
      return renderer?.overlay ?? null;
    },
    onFrame(listener) {
      frameListeners.add(listener);
      return () => frameListeners.delete(listener);
    },
    stats() {
      if (renderer === null || host === null) return null;
      return { ...renderer.stats, displayObjects: countDisplayObjects(host.app.stage) };
    },
    destroy() {
      if (abort.signal.aborted) return;
      abort.abort();
      liveSessions.delete(session);
      frameListeners.clear();
      try {
        scope.dispose();
      } finally {
        renderer?.destroy();
        renderer = null;
        host?.destroy();
        host = null;
      }
    },
  };
  liveSessions.add(session);

  boot().catch((error: unknown) => {
    if (error instanceof SessionAbortedError || abort.signal.aborted) return;
    console.error('The game could not start', error);
    store.setFailure(describe(error));
  });
  return session;
}
