import { useId, useState } from 'react';
import type { PlayerOptions } from '../../../config/options';
import { OPTION_BOUNDS } from '../../../config/options';
import { Button } from '../../components/Button';
import { Stepper } from '../../components/Stepper';
import { CaptainNameDialog } from '../../profile/CaptainNameDialog';
import { createCaptain, renameCaptain } from '../../state/profile';
import { optionsStore, profileStore, usePersisted, usePersistedValue } from '../../state/settings';
import screen from '../screen.module.css';
import styles from './OptionsPanel.module.css';

const SECONDS = { short: 's', long: 'seconds' } as const;

interface OptionsPanelProps {
  /** `pause`: opened from the pause menu; changes then apply to the next battle only. */
  readonly context: 'menu' | 'pause';
  readonly doneLabel: string;
  readonly onDone: () => void;
  /** Id for the heading, so a surrounding panel or dialog can be labelled by it. */
  readonly headingId: string;
}

type SaveStatus = 'idle' | 'saved' | 'unsaved';

/**
 * Options (assets/sample_options.png): session time and spawn interval as
 * spinbuttons, saved as soon as a valid value is set, and the captain name.
 * Corrupted saved options were replaced by the defaults when read; the
 * player is told so here.
 */
export function OptionsPanel({ context, doneLabel, onDone, headingId }: OptionsPanelProps) {
  const id = useId();
  const { value: options, recovered } = usePersisted(optionsStore);
  const profile = usePersistedValue(profileStore);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [renaming, setRenaming] = useState(false);

  const update = (change: Partial<PlayerOptions>): void => {
    setStatus(optionsStore.set({ ...options, ...change }) ? 'saved' : 'unsaved');
  };

  return (
    <>
      <h2 id={headingId} className={screen.heading}>
        Options
      </h2>
      {recovered ? (
        <p className={screen.notice} role="alert">
          Your saved options could not be read, so the defaults are back. Any change you make is
          saved again.
        </p>
      ) : null}
      {context === 'pause' ? (
        <p className={`${screen.text} ${screen.muted}`}>
          Changes apply to the next battle, not the current one.
        </p>
      ) : null}
      <Stepper
        label="Game session time"
        value={options.sessionSeconds}
        bounds={OPTION_BOUNDS.sessionSeconds}
        unit={SECONDS}
        onChange={(sessionSeconds) => {
          update({ sessionSeconds });
        }}
      />
      <Stepper
        label="Enemy spawn time"
        value={options.spawnIntervalSeconds}
        bounds={OPTION_BOUNDS.spawnIntervalSeconds}
        unit={SECONDS}
        onChange={(spawnIntervalSeconds) => {
          update({ spawnIntervalSeconds });
        }}
      />
      <p className={screen.status} role="status">
        {status === 'saved' ? 'Options saved.' : null}
        {status === 'unsaved'
          ? 'Could not save on this device: the change lasts until you close the game.'
          : null}
      </p>
      <div className={styles.captain}>
        <span id={`${id}-captain`} className={screen.text}>
          Captain: <strong>{profile?.name ?? 'not chosen yet'}</strong>
        </span>
        <Button
          variant="secondary"
          size="small"
          aria-describedby={`${id}-captain`}
          onClick={() => {
            setRenaming(true);
          }}
        >
          {profile === null ? 'Choose name' : 'Rename'}
        </Button>
      </div>
      <Button onClick={onDone}>{doneLabel}</Button>

      {renaming ? (
        <CaptainNameDialog
          mode={profile === null ? 'create' : 'rename'}
          initialName={profile?.name ?? ''}
          onCancel={() => {
            setRenaming(false);
          }}
          onConfirm={(name) => {
            if (profile === null) createCaptain(name);
            else renameCaptain(profile, name);
            setRenaming(false);
          }}
        />
      ) : null}
    </>
  );
}
