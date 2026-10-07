import type { AtlasIconName } from './uiArt';
import { iconImageSet } from './uiArt';
import styles from './Icon.module.css';

interface AtlasIconProps {
  readonly name: AtlasIconName;
  readonly className?: string | undefined;
}

/** Decorative atlas icon; the control around it carries the accessible name. */
export function AtlasIcon({ name, className }: AtlasIconProps) {
  return (
    <span
      aria-hidden="true"
      className={className === undefined ? styles.icon : `${styles.icon} ${className}`}
      style={{ backgroundImage: iconImageSet(name) }}
    />
  );
}

/**
 * Icons the atlas lacks (sound, help, previous/next), drawn as small SVGs in
 * the atlas style: cream fill with a dark brown outline (docs/DECISIONS.md A5).
 */
export type DrawnIconName = 'soundOn' | 'soundOff' | 'help' | 'previous' | 'next';

const PATHS: Readonly<Record<DrawnIconName, string>> = {
  soundOn: 'M5 9h4l5-4v14l-5-4H5zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12',
  soundOff: 'M5 9h4l5-4v14l-5-4H5zM16.5 9.5l5 5M21.5 9.5l-5 5',
  help: 'M9 9.2a3 3 0 1 1 4.3 2.7c-.8.4-1.3 1-1.3 1.9v.7M12 17.6v.4',
  previous: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
};

interface DrawnIconProps {
  readonly name: DrawnIconName;
  readonly className?: string | undefined;
}

export function DrawnIcon({ name, className }: DrawnIconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className={className === undefined ? styles.drawn : `${styles.drawn} ${className}`}
    >
      <path d={PATHS[name]} className={styles.outline} />
      <path d={PATHS[name]} className={styles.stroke} />
    </svg>
  );
}
