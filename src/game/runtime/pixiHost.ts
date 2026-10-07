import { Application } from 'pixi.js';
import { DisposableScope } from '../../platform/disposableScope';
import { trackResource } from '../../platform/resourceCounters';
import type { Size, Viewport } from '../render';
import { fitViewport } from '../render';

/** Sharper than 2× costs fill rate without a visible gain for this art. */
const MAX_RESOLUTION = 2;
const BACKGROUND = 0x1f8fb3;

export interface PixiHost {
  readonly app: Application;
  readonly viewport: Viewport;
  /** Called after every resize or device-pixel-ratio change. */
  onViewportChange(listener: (viewport: Viewport) => void): void;
  destroy(): void;
}

export const deviceResolution = (): number =>
  Math.min(window.devicePixelRatio || 1, MAX_RESOLUTION);

const containerSize = (container: HTMLElement): Size => ({
  width: container.clientWidth,
  height: container.clientHeight,
});

/**
 * Creates the Pixi application inside `container`. Pixi v8 initialises
 * asynchronously and cannot be cancelled midway, so an abort during `init`
 * destroys the half-made app and resolves `null`: the canvas is only attached
 * once nothing can abort anymore, so a Strict Mode double mount never shows
 * two canvases.
 */
export async function createPixiHost(
  container: HTMLElement,
  world: Size,
  signal: AbortSignal,
): Promise<PixiHost | null> {
  const app = new Application();
  const releaseApp = trackResource('applications');
  const size = containerSize(container);
  try {
    await app.init({
      width: Math.max(1, size.width),
      height: Math.max(1, size.height),
      resolution: deviceResolution(),
      autoDensity: true,
      antialias: true,
      background: BACKGROUND,
      preference: 'webgl',
    });
  } catch (error) {
    releaseApp();
    throw error;
  }
  if (signal.aborted) {
    app.destroy({ removeView: true }, { children: true });
    releaseApp();
    return null;
  }

  const scope = new DisposableScope();
  const listeners = new Set<(viewport: Viewport) => void>();
  let viewport = fitViewport(size, world);

  const resize = (): void => {
    const next = containerSize(container);
    app.renderer.resize(Math.max(1, next.width), Math.max(1, next.height), deviceResolution());
    viewport = fitViewport(next, world);
    for (const listener of listeners) listener(viewport);
  };

  // A device-pixel-ratio change (zoom, moving to another screen) does not always
  // resize the container. The media query only matches one ratio, so it is
  // re-armed for the new ratio after every change.
  let unwatch = (): void => undefined;
  const watchResolution = (): void => {
    const query = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    const release = trackResource('listeners');
    const onChange = (): void => {
      unwatch();
      resize();
      watchResolution();
    };
    query.addEventListener('change', onChange);
    unwatch = () => {
      query.removeEventListener('change', onChange);
      release();
    };
  };
  scope.add(() => {
    unwatch();
  });

  app.canvas.style.display = 'block';
  container.appendChild(app.canvas);
  scope.observeResize(container, resize);
  watchResolution();

  return {
    app,
    get viewport() {
      return viewport;
    },
    onViewportChange(listener) {
      listeners.add(listener);
      scope.add(() => listeners.delete(listener));
    },
    destroy() {
      if (scope.disposed) return;
      try {
        scope.dispose();
      } finally {
        // Atlas textures are page-wide and cached: never destroy them with the stage.
        app.destroy({ removeView: true }, { children: true, texture: false, textureSource: false });
        releaseApp();
      }
    },
  };
}
