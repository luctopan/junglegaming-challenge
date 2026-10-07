import type { Container } from 'pixi.js';
import type { GameConfig } from '../../config/gameConfig';
import { DisposableScope } from '../../platform/disposableScope';
import { realClock } from '../../platform/clock';
import { trackResource } from '../../platform/resourceCounters';
import type { Clock } from '../../shared/clock';
import { MS_PER_SECOND } from '../../shared/math/constants';
import type { DomainEvent } from '../core';
import { getPlayer, timeLeftSeconds } from '../core';
import type { GameStore, PauseReason } from '../bridge/gameStore';
import { toPercent } from '../bridge/gameStore';
import type { EdgeCommand, TouchSource } from '../input';
import { attachKeyboard, attachTouchControls } from '../input';
import type { AudioEngine, CombatAtlases, RenderStats, WorldView } from '../render';
import {
  createAudioEngine,
  fitViewport,
  loadCombatAssets,
  preferredTextureResolution,
  WorldRenderer,
} from '../render';
import type { InputSource } from './inputSource';
import { MatchDriver } from './matchDriver';
import type { PixiHost } from './pixiHost';
import { createPixiHost } from './pixiHost';
import type { StateSnapshot } from './stateSnapshot';
import { snapshotState } from './stateSnapshot';
import { tickerShouldRun } from './renderPolicy';
import { testControls } from './testControls';

export interface GameSessionOptions {
  /** Element the canvas is attached to (sized by the UI). */
  readonly container: HTMLElement;
  /** Ancestor of the on-screen touch controls; omit for no touch input. */
  readonly controlsRoot?: HTMLElement | null;
  readonly store: GameStore;
  readonly config: GameConfig;
  readonly seed: number;
  /** URL prefix of the generated runtime assets (`public/assets/`). */
  readonly assetBasePath: string;
  /** Scripted player input (dev sandbox); replaces keyboard and touch. */
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
  /** Pauses a running match; ignored otherwise. */
  pause(reason?: PauseReason): void;
  /** Resumes a paused match. Only an explicit player action may call this. */
  resume(): void;
  /** Fresh match on the same canvas: new world, time, input and pause state. */
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

/** Test-hook access to a session (see testHook.ts); not part of the UI-facing API. */
export interface SessionInternals {
  /** Runs the simulation steps due on the clock, without rendering. */
  simulate(): void;
  /** Runs one full frame (events, views, store) and renders it now. */
  render(): void;
  /** Frames rendered so far (ticker frames and on-demand renders). */
  framesRendered(): number;
  /** Null until the arena is shown. */
  snapshot(): StateSnapshot | null;
}

const liveSessions = new Map<GameSession, SessionInternals>();

/** Sessions currently alive in the page (the test hook sums their resources). */
export const activeSessions = (): readonly GameSession[] => [...liveSessions.keys()];

export const sessionInternals = (): readonly SessionInternals[] => [...liveSessions.values()];

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
 * Destroying a session before its match ended abandons the match: no result
 * exists for it, so it can never be recorded.
 */
export function createGameSession(options: GameSessionOptions): GameSession {
  const { container, store, config, assetBasePath } = options;
  const overrides = testControls();
  const clock = overrides?.manualClock ?? options.clock ?? realClock;
  // Test manual clock: frames are rendered on demand (renderPolicy.ts).
  const renderOnDemand = overrides !== null && overrides.manualClock === clock;
  const abort = new AbortController();
  const scope = new DisposableScope();
  const frameListeners = new Set<(world: WorldView) => void>();
  const audio: AudioEngine = createAudioEngine({
    basePath: assetBasePath,
    muted: options.muted ?? false,
  });
  scope.add(() => {
    audio.destroy();
  });

  const newDriver = (seed: number): MatchDriver =>
    new MatchDriver({ config, seed, clock, scripted: options.input });

  let driver = newDriver(overrides?.seed ?? options.seed);
  let touch: TouchSource | null = null;
  let host: PixiHost | null = null;
  let renderer: WorldRenderer | null = null;
  let lastFrameMs: number | null = null;
  let resumeRetry: (() => void) | null = null;
  let framesRendered = 0;
  /** Events of simulation-only frames, played by the next rendered frame. */
  let unplayedEvents: DomainEvent[] = [];

  const publish = (): void => {
    const { world } = driver;
    const player = getPlayer(world);
    store.publishMatch({
      score: world.score,
      secondsLeft: Math.ceil(timeLeftSeconds(world)),
      hp: Math.ceil(player.hp),
      maxHp: player.maxHp,
      endReason: world.endReason,
    });
    store.setPhase(driver.state, driver.pauseReason);
  };

  const frame = (): void => {
    if (renderer === null) return;
    const animating = driver.state !== 'paused';
    const now = clock.now();
    const dtSeconds =
      lastFrameMs === null || !animating
        ? 0
        : Math.min(config.simulation.maxFrameSeconds, (now - lastFrameMs) / MS_PER_SECOND);
    lastFrameMs = animating ? now : null;
    const alpha = driver.tick();
    const events = [...unplayedEvents, ...driver.drainEvents()];
    unplayedEvents = [];
    framesRendered += 1;
    if (events.length > 0) {
      renderer.playEvents(events, driver.world);
      audio.playEvents(events, driver.world.playerId);
    }
    // While paused, effects, water and camera shake freeze with the match.
    renderer.update(dtSeconds);
    renderer.sync(driver.world, alpha);
    publish();
    for (const listener of frameListeners) listener(driver.world);
  };

  /** One frame rendered right now, for a stopped ticker (paused, manual clock, resize). */
  const renderNow = (): void => {
    if (host === null || renderer === null) return;
    frame();
    host.app.render();
  };

  /** Starts or stops continuous rendering for the current state (renderPolicy.ts). */
  const syncTicker = (): void => {
    if (host === null) return;
    if (tickerShouldRun(renderOnDemand, driver.state)) host.app.ticker.start();
    else host.app.ticker.stop();
  };

  const releaseHeldInput = (): void => {
    driver.input.clear();
    touch?.releaseAll();
  };

  const pause = (reason: PauseReason): void => {
    if (renderer === null || !driver.pause(reason)) return;
    releaseHeldInput();
    audio.setPaused(true);
    // One last frame shows the paused state; then nothing renders until Resume.
    renderNow();
    syncTicker();
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
    const arena = { width: driver.world.arena.width, height: driver.world.arena.height };
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
    releaseHeldInput();
    audio.setPaused(false);
    driver.start();
    audio.play('matchStart');
    audio.startAmbience();
    // A match that starts in a background tab must not run unseen.
    if (document.visibilityState === 'hidden') pause('hidden');
    publish();
    syncTicker();
    if (host !== null && !host.app.ticker.started) renderNow();
  };

  const unlockAudio = (): void => {
    audio.unlock();
  };

  // A Record keeps the command set exhaustive: a new EdgeCommand fails to compile here.
  const commands: Readonly<Record<EdgeCommand, () => void>> = {
    pause: () => {
      pause('manual');
    },
  };

  const listenForInput = (): void => {
    const isActive = (): boolean => renderer !== null && driver.state === 'running';
    if (options.input === undefined) {
      attachKeyboard(scope, {
        target: window,
        state: () => driver.input,
        isActive,
        onCommand: (command) => {
          commands[command]();
        },
      });
      const controlsRoot = options.controlsRoot ?? null;
      if (controlsRoot !== null) {
        touch = attachTouchControls(scope, {
          root: controlsRoot,
          state: () => driver.input,
          isActive,
        });
      }
    }
    // Auto-pause: a match never runs while the player cannot see or control it.
    scope.listen(window, 'blur', () => {
      pause('blur');
    });
    scope.listen(document, 'visibilitychange', () => {
      if (document.visibilityState === 'hidden') pause('hidden');
    });
  };

  const boot = async (): Promise<void> => {
    const atlases = await loadAssets();
    const pixi = await createPixiHost(
      container,
      { width: driver.world.arena.width, height: driver.world.arena.height },
      abort.signal,
    );
    if (pixi === null) throw new SessionAbortedError();
    host = pixi;
    renderer = new WorldRenderer(atlases, driver.world.arena);
    pixi.app.stage.addChild(renderer.root);
    renderer.setViewport(pixi.viewport);
    pixi.onViewportChange((viewport) => {
      renderer?.setViewport(viewport);
      // A resized canvas is cleared: redraw it even when the ticker is stopped.
      if (!pixi.app.ticker.started) renderNow();
    });
    pixi.app.ticker.add(frame);
    const releaseTicker = trackResource('tickerCallbacks');
    scope.add(() => {
      pixi.app.ticker.remove(frame);
      releaseTicker();
    });
    // Autoplay rules: sound may start only after a user gesture.
    // (`userActivation` is missing in some browsers: then the first gesture unlocks.)
    if ('userActivation' in navigator && navigator.userActivation.hasBeenActive) unlockAudio();
    scope.listen(window, 'pointerdown', unlockAudio);
    scope.listen(window, 'keydown', unlockAudio);
    listenForInput();
    startMatch();
  };

  const session: GameSession = {
    retryAssets() {
      const resume = resumeRetry;
      resumeRetry = null;
      resume?.();
    },
    pause(reason = 'manual') {
      pause(reason);
    },
    resume() {
      if (!driver.resume()) return;
      releaseHeldInput();
      lastFrameMs = null;
      audio.setPaused(false);
      publish();
      syncTicker();
    },
    restart(seed) {
      if (abort.signal.aborted) return;
      // A test seed wins over the UI's random one, so replays stay deterministic.
      driver = newDriver(testControls()?.seed ?? seed ?? options.seed);
      touch?.releaseAll();
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
  liveSessions.set(session, {
    simulate() {
      if (renderer === null) return;
      driver.tick();
      const events = driver.drainEvents();
      // Effects of frames never shown are dropped; the rendered frame plays the latest ones.
      if (events.length > 0) unplayedEvents = events;
    },
    render: renderNow,
    framesRendered: () => framesRendered,
    snapshot: () =>
      renderer === null
        ? null
        : snapshotState(driver.world, driver.state, driver.pauseReason, driver.input.idle),
  });

  boot().catch((error: unknown) => {
    if (error instanceof SessionAbortedError || abort.signal.aborted) return;
    console.error('The game could not start', error);
    store.setFailure(describe(error));
  });
  return session;
}
