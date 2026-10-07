import { audioStore, usePersistedValue } from '../state/settings';
import { RoundButton } from './RoundButton';

interface SoundToggleProps {
  readonly size?: 'small' | 'medium' | 'large' | undefined;
  readonly className?: string | undefined;
}

/** Mute toggle (`aria-pressed` = muted), persisted for every screen and the next visit. */
export function SoundToggle({ size, className }: SoundToggleProps) {
  const { muted } = usePersistedValue(audioStore);
  return (
    <RoundButton
      label="Mute sound"
      aria-pressed={muted}
      icon={{ drawn: muted ? 'soundOff' : 'soundOn' }}
      size={size}
      className={className}
      onClick={() => {
        audioStore.set({ muted: !muted });
      }}
    />
  );
}
