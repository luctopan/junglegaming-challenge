import type { ComponentPropsWithRef } from 'react';
import styles from './Panel.module.css';

interface PanelProps extends ComponentPropsWithRef<'section'> {
  /** `wide` is the Captain's Log panel (tables); `menu` the narrow menu panel. */
  readonly size?: 'menu' | 'wide';
}

/**
 * The wooden menu panel from the UI atlas (`panel_menu`), drawn as a CSS
 * 9-slice with `border-image`, so it stretches to any content without
 * distorting the brass corners.
 */
export function Panel({ size = 'menu', className, ...rest }: PanelProps) {
  const classes = [styles.panel, styles[size], className].filter(Boolean).join(' ');
  return <section className={classes} {...rest} />;
}
