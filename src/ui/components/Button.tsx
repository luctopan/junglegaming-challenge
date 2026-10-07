import type { ComponentPropsWithRef } from 'react';
import styles from './Button.module.css';

interface ButtonProps extends ComponentPropsWithRef<'button'> {
  /** `primary`: gold menu button; `secondary`: navy button (also the inactive tab). */
  readonly variant?: 'primary' | 'secondary';
  readonly size?: 'regular' | 'small';
}

/**
 * Menu button from the UI atlas: normal / hover / pressed / disabled art per
 * variant (states the atlas lacks are derived in CSS), plus our own focus ring.
 */
export function Button({
  variant = 'primary',
  size = 'regular',
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [styles.button, styles[variant], styles[size], className]
    .filter(Boolean)
    .join(' ');
  return <button type={type} className={classes} {...rest} />;
}
