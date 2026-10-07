import type { KeyboardEvent } from 'react';
import { useId, useState } from 'react';
import type { OptionBounds } from '../../config/options';
import { RoundButton } from './RoundButton';
import { formatStepperValue, parseTypedValue, stepValue } from './stepperValue';
import styles from './Stepper.module.css';

interface StepperProps {
  readonly label: string;
  readonly value: number;
  readonly bounds: OptionBounds;
  /** Unit shown after the value and spelled out for screen readers. */
  readonly unit: { readonly short: string; readonly long: string };
  /** Called with valid values only. */
  readonly onChange: (value: number) => void;
}

/** Arrow keys move one step; Page keys move this many. */
const PAGE_STEPS = 5;

const KEY_STEPS: Readonly<Record<string, number>> = {
  ArrowUp: 1,
  ArrowRight: 1,
  ArrowDown: -1,
  ArrowLeft: -1,
  PageUp: PAGE_STEPS,
  PageDown: -PAGE_STEPS,
  Home: Number.NEGATIVE_INFINITY,
  End: Number.POSITIVE_INFINITY,
};

/**
 * Numeric option as an ARIA spinbutton with the mockup's −/+ round buttons.
 * Keyboard: arrows, Page Up/Down, Home/End. Typing is allowed; the value is
 * checked on Enter or when leaving the field, and an invalid entry shows an
 * accessible error and is never saved (Escape restores the saved value).
 */
export function Stepper({ label, value, bounds, unit, onChange }: StepperProps) {
  const id = useId();
  const labelId = `${id}-label`;
  const errorId = `${id}-error`;
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const commit = (next: number): void => {
    setDraft(null);
    setError(null);
    if (next !== value) onChange(next);
  };

  const commitDraft = (): void => {
    if (draft === null) return;
    const parsed = parseTypedValue(draft, bounds);
    if (parsed.ok) commit(parsed.value);
    else setError(`${label}: ${parsed.message}`);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    const steps = KEY_STEPS[event.key];
    if (steps !== undefined) {
      event.preventDefault();
      commit(stepValue(value, bounds, steps));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      commitDraft();
    } else if (event.key === 'Escape' && (draft !== null || error !== null)) {
      // Handled here, so an enclosing dialog does not close on the same key.
      event.stopPropagation();
      setDraft(null);
      setError(null);
    }
  };

  const shown = formatStepperValue(value, bounds);
  return (
    <div className={styles.field}>
      <span id={labelId} className={styles.label}>
        {label}
      </span>
      <div className={styles.row}>
        <RoundButton
          label={`Decrease ${label.toLowerCase()}`}
          icon={{ atlas: 'minus' }}
          disabled={value <= bounds.min}
          onClick={() => {
            commit(stepValue(value, bounds, -1));
          }}
        />
        <div className={styles.valueBox}>
          <input
            className={styles.input}
            role="spinbutton"
            inputMode="decimal"
            autoComplete="off"
            aria-labelledby={labelId}
            aria-valuenow={value}
            aria-valuemin={bounds.min}
            aria-valuemax={bounds.max}
            aria-valuetext={`${shown} ${unit.long}`}
            aria-invalid={error !== null}
            aria-describedby={error === null ? undefined : errorId}
            value={draft ?? shown}
            size={4}
            onChange={(event) => {
              setDraft(event.target.value);
              setError(null);
            }}
            onKeyDown={onKeyDown}
            onBlur={commitDraft}
          />
          <span aria-hidden="true" className={styles.unit}>
            {unit.short}
          </span>
        </div>
        <RoundButton
          label={`Increase ${label.toLowerCase()}`}
          icon={{ atlas: 'plus' }}
          disabled={value >= bounds.max}
          onClick={() => {
            commit(stepValue(value, bounds, 1));
          }}
        />
      </div>
      <p id={errorId} className={styles.error} role="alert">
        {error}
      </p>
    </div>
  );
}
