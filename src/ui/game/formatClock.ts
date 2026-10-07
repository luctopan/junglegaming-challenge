const SECONDS_PER_MINUTE = 60;

/** `m:ss` for the HUD timer (whole seconds, rounded up like the bridge snapshot). */
export const formatClock = (seconds: number): string => {
  const whole = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(whole / SECONDS_PER_MINUTE);
  return `${minutes}:${String(whole % SECONDS_PER_MINUTE).padStart(2, '0')}`;
};
