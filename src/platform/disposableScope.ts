import { trackResource } from './resourceCounters';

/**
 * Collects every teardown step of an owner (listeners, observers, timers,
 * callbacks) so `dispose()` releases all of them in reverse order, exactly
 * once. Resources added after disposal are released immediately, which makes
 * late async steps (e.g. after an aborted init) safe.
 */
export class DisposableScope {
  #disposers: (() => void)[] = [];
  #disposed = false;

  get disposed(): boolean {
    return this.#disposed;
  }

  add(dispose: () => void): void {
    if (this.#disposed) {
      dispose();
      return;
    }
    this.#disposers.push(dispose);
  }

  listen<K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    listener: (event: WindowEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ): void;
  listen(
    target: EventTarget,
    type: string,
    listener: (event: Event) => void,
    options?: AddEventListenerOptions,
  ): void;
  listen(
    target: EventTarget,
    type: string,
    listener: (event: Event) => void,
    options?: AddEventListenerOptions,
  ): void {
    if (this.#disposed) return;
    target.addEventListener(type, listener, options);
    const release = trackResource('listeners');
    this.add(() => {
      target.removeEventListener(type, listener, options);
      release();
    });
  }

  observeResize(element: Element, callback: () => void): void {
    if (this.#disposed) return;
    const observer = new ResizeObserver(callback);
    observer.observe(element);
    const release = trackResource('observers');
    this.add(() => {
      observer.disconnect();
      release();
    });
  }

  /**
   * Runs every disposer even if one throws, then rethrows: a failing teardown
   * step must neither leak the others nor go unnoticed.
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    const errors: unknown[] = [];
    for (const dispose of this.#disposers.reverse()) {
      try {
        dispose();
      } catch (error) {
        errors.push(error);
      }
    }
    this.#disposers = [];
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, 'Several teardown steps failed');
  }
}
