/**
 * URLs of the individual UI atlas PNGs (`assets/png/{default,retina}/ui/**`),
 * bundled and hashed by Vite. CSS modules reference the static pieces
 * (panels, buttons) directly; this map serves art chosen at runtime (icons,
 * HP fills) as `image-set()` so 2× screens get the retina PNG.
 */
const files = import.meta.glob<string>('../../../assets/png/{default,retina}/ui/*/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

export type UiFamily = 'menu' | 'controls' | 'hud';

const urlOf = (density: 'default' | 'retina', family: UiFamily, name: string): string => {
  const url = files[`../../../assets/png/${density}/ui/${family}/${name}.png`];
  if (url === undefined) throw new Error(`Missing UI art: ${density}/${family}/${name}.png`);
  return url;
};

/** `image-set()` value for a UI atlas frame (1× and 2×). */
export const uiImageSet = (family: UiFamily, name: string): string =>
  `image-set(url("${urlOf('default', family, name)}") 1x, url("${urlOf('retina', family, name)}") 2x)`;

/** Atlas icons, by frame name without the `icon_` prefix. */
export type AtlasIconName =
  | 'close'
  | 'fire_front'
  | 'fire_left'
  | 'fire_right'
  | 'forward'
  | 'heart'
  | 'home'
  | 'minus'
  | 'pause'
  | 'play'
  | 'plus'
  | 'restart'
  | 'score'
  | 'settings'
  | 'time'
  | 'turn_left'
  | 'turn_right';

const HUD_ICONS: ReadonlySet<AtlasIconName> = new Set(['heart', 'score', 'time']);

export const iconImageSet = (name: AtlasIconName): string =>
  uiImageSet(HUD_ICONS.has(name) ? 'hud' : 'controls', `icon_${name}`);
