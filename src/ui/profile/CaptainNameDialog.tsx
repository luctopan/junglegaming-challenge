import type { SyntheticEvent } from 'react';
import { useId, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { Dialog } from '../components/Dialog';
import screen from '../screens/screen.module.css';
import { CAPTAIN_NAME_MAX, CAPTAIN_NAME_MIN, validateCaptainName } from './captainName';

interface CaptainNameDialogProps {
  /** `create`: first Play; `rename`: from Options. */
  readonly mode: 'create' | 'rename';
  readonly initialName?: string;
  readonly onConfirm: (name: string) => void;
  readonly onCancel: () => void;
}

const COPY = {
  create: {
    title: 'Choose your captain name',
    text: 'Your name appears in the ranking and your match history.',
    confirm: 'Set sail',
  },
  rename: {
    title: 'Rename your captain',
    text: 'Your past battles stay yours under the new name.',
    confirm: 'Save name',
  },
} as const;

/**
 * Captain name form in a modal dialog: validated on submit (and live once an
 * error is shown), with the error linked to the field and announced.
 */
export function CaptainNameDialog({
  mode,
  initialName = '',
  onConfirm,
  onCancel,
}: CaptainNameDialogProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[mode];

  const onSubmit = (event: SyntheticEvent): void => {
    event.preventDefault();
    const result = validateCaptainName(name);
    if (result.ok) {
      onConfirm(result.name);
    } else {
      setError(result.message);
      inputRef.current?.focus();
    }
  };

  return (
    <Dialog
      labelledBy={`${id}-title`}
      describedBy={`${id}-text`}
      initialFocus={inputRef}
      onEscape={onCancel}
    >
      <h2 id={`${id}-title`} className={screen.heading}>
        {copy.title}
      </h2>
      <p id={`${id}-text`} className={screen.text}>
        {copy.text}
      </p>
      <form className={screen.form} noValidate onSubmit={onSubmit}>
        <label htmlFor={`${id}-name`} className={`${screen.text} ${screen.small}`}>
          Captain name
        </label>
        <input
          ref={inputRef}
          id={`${id}-name`}
          className={screen.textInput}
          type="text"
          autoComplete="nickname"
          spellCheck={false}
          maxLength={CAPTAIN_NAME_MAX * 2}
          value={name}
          aria-invalid={error !== null}
          aria-describedby={`${id}-hint${error === null ? '' : ` ${id}-error`}`}
          onChange={(event) => {
            setName(event.target.value);
            if (error !== null) {
              const result = validateCaptainName(event.target.value);
              setError(result.ok ? null : result.message);
            }
          }}
        />
        <p id={`${id}-hint`} className={`${screen.text} ${screen.small} ${screen.muted}`}>
          {CAPTAIN_NAME_MIN}–{CAPTAIN_NAME_MAX} characters: letters, numbers, spaces, &apos; and -
        </p>
        <p id={`${id}-error`} className={screen.error} role="alert">
          {error}
        </p>
        <div className={screen.actions}>
          <Button type="submit">{copy.confirm}</Button>
          <Button variant="secondary" size="small" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
