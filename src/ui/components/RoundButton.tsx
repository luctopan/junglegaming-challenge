import type { ComponentPropsWithRef } from 'react';
import type { DrawnIconName } from './Icon';
import { AtlasIcon, DrawnIcon } from './Icon';
import type { AtlasIconName } from './uiArt';
import styles from './RoundButton.module.css';

type RoundIcon =
  | { readonly atlas: AtlasIconName; readonly drawn?: never }
  | { readonly drawn: DrawnIconName; readonly atlas?: never };

type RoundButtonProps = Omit<ComponentPropsWithRef<'button'>, 'children'> & {
  /** Accessible name (the button shows only an icon). */
  readonly label: string;
  readonly icon: RoundIcon;
  readonly size?: 'small' | 'medium' | 'large';
};

/** Round icon button from the UI atlas (normal / hover / pressed; disabled derived in CSS). */
export function RoundButton({
  label,
  icon,
  size = 'medium',
  className,
  type = 'button',
  ...rest
}: RoundButtonProps) {
  const classes = [styles.round, styles[size], className].filter(Boolean).join(' ');
  return (
    <button type={type} className={classes} aria-label={label} {...rest}>
      {icon.atlas !== undefined ? (
        <AtlasIcon name={icon.atlas} className={styles.icon} />
      ) : (
        <DrawnIcon name={icon.drawn} className={styles.icon} />
      )}
    </button>
  );
}
