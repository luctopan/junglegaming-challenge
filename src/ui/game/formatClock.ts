const SECONDS_PER_MINUTE = 60;
const MS_PER_SECOND = 1000;

const twoDigits = (value: number): string => String(value).padStart(2, '0');

/** `mm:ss` for the HUD timer (whole seconds, rounded up like the bridge snapshot). */
export const formatClock = (seconds: number): string => {
  const whole = Math.max(0, Math.ceil(seconds));
  return `${twoDigits(Math.floor(whole / SECONDS_PER_MINUTE))}:${twoDigits(whole % SECONDS_PER_MINUTE)}`;
};

/** `mm:ss` of a played duration (whole seconds, rounded down: 119.9 s played shows 01:59). */
export const formatDuration = (ms: number): string => {
  const whole = Math.max(0, Math.floor(ms / MS_PER_SECOND));
  return `${twoDigits(Math.floor(whole / SECONDS_PER_MINUTE))}:${twoDigits(whole % SECONDS_PER_MINUTE)}`;
};

/** Spoken form for screen readers: "1 minute 5 seconds". */
export function spokenDuration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(whole / SECONDS_PER_MINUTE);
  const rest = whole % SECONDS_PER_MINUTE;
  const parts: string[] = [];
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`);
  if (rest > 0 || minutes === 0) parts.push(`${rest} ${rest === 1 ? 'second' : 'seconds'}`);
  return parts.join(' ');
}
