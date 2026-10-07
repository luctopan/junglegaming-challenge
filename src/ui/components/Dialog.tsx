import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, RefObject } from 'react';
import { useEffect, useRef } from 'react';
import { focusableIn, wrapTarget } from '../a11y/focusTrap';
import { Panel } from './Panel';
import styles from './Dialog.module.css';

interface DialogProps {
  /** Id of the visible title (the dialog's accessible name). */
  readonly labelledBy: string;
  readonly describedBy?: string | undefined;
  /** Focused when the dialog opens; defaults to its first focusable element. */
  readonly initialFocus?: RefObject<HTMLElement | null> | undefined;
  /**
   * Escape handler. Dialogs that cannot be dismissed leave it out; the pause
   * dialog uses it for its own resume rules.
   */
  readonly onEscape?: ((event: ReactKeyboardEvent) => void) | undefined;
  /**
   * Where focus goes when the dialog closes. Default: the element focused when
   * it opened. `null`: leave focus alone (the next view manages it).
   */
  readonly returnFocusTo?: HTMLElement | null | undefined;
  /** Runs first for every key; preventing the default skips the dialog's own handling. */
  readonly onKeyDown?: ((event: ReactKeyboardEvent) => void) | undefined;
  readonly size?: 'menu' | 'wide';
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

/**
 * Modal dialog on the atlas panel over a dimmed scrim: `role="dialog"` +
 * `aria-modal`, initial focus, Tab/Shift+Tab kept inside, optional Escape,
 * and focus returned to the element that opened it when it closes.
 */
export function Dialog({
  labelledBy,
  describedBy,
  initialFocus,
  onEscape,
  onKeyDown: onKey,
  returnFocusTo,
  size = 'menu',
  className,
  children,
}: DialogProps) {
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const opener = returnFocusTo === undefined ? active : returnFocusTo;
    const target = initialFocus?.current ?? focusableIn(dialog)[0] ?? dialog;
    target.focus();
    return () => {
      // Back to the opener if it is still on screen (e.g. not when the screen changed).
      if (opener?.isConnected === true) opener.focus();
    };
  }, [initialFocus, returnFocusTo]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>): void => {
    onKey?.(event);
    if (event.defaultPrevented) return;
    // Handled by the innermost dialog only (a dialog may open over another one).
    if (event.key === 'Escape' && onEscape !== undefined) {
      event.stopPropagation();
      onEscape(event);
      return;
    }
    if (event.key !== 'Tab') return;
    event.stopPropagation();
    const focusables = focusableIn(event.currentTarget);
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const target = wrapTarget(focusables, active, event.shiftKey);
    if (target === null) return;
    event.preventDefault();
    target.focus();
  };

  return (
    <div className={styles.scrim}>
      <Panel
        ref={dialogRef}
        size={size}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={className === undefined ? styles.dialog : `${styles.dialog} ${className}`}
        onKeyDown={onKeyDown}
      >
        {children}
      </Panel>
    </div>
  );
}
