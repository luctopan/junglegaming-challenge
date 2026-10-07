import { useCallback, useSyncExternalStore } from 'react';

/** Touch is the primary input (phones, tablets): touch controls and touch help. */
export const COARSE_POINTER = '(pointer: coarse)';
/** Portrait on a touch device: gameplay is landscape-only (docs/DECISIONS.md). */
export const TOUCH_PORTRAIT = '(orientation: portrait) and (pointer: coarse)';

/** Live result of a CSS media query (re-renders only when it flips). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => {
        list.removeEventListener('change', onChange);
      };
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}
