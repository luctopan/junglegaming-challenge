import type { Spritesheet, Texture } from 'pixi.js';

/** Where the fill of a bar sprite is drawn and how it shrinks (UI atlas `ui.layout`, 1× units). */
export interface FillLayout {
  readonly fillRect: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly clipAxis: 'x';
  readonly clipOrigin: 'left';
}

/** Read-only access to one loaded sprite sheet. Names are atlas frame names. */
export interface Atlas {
  texture(name: string): Texture;
  /** `ui.layout` of a frame (UI atlas only). */
  fillLayout(name: string): FillLayout;
  readonly textureCount: number;
}

export interface CombatAtlases {
  readonly ships: Atlas;
  readonly tiles: Atlas;
  readonly ui: Atlas;
}

export class AtlasFrameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AtlasFrameError';
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isRect = (value: unknown): value is FillLayout['fillRect'] =>
  isRecord(value) && ['x', 'y', 'w', 'h'].every((key) => typeof value[key] === 'number');

/** Validates the `ui.layout` block the asset pack adds to bar frames (see docs/ASSETS.md). */
export function parseFillLayout(frameData: unknown, name: string): FillLayout {
  const layout = isRecord(frameData) && isRecord(frameData.ui) ? frameData.ui.layout : undefined;
  if (!isRecord(layout) || !isRect(layout.fill_rect)) {
    throw new AtlasFrameError(`Frame "${name}" has no ui.layout.fill_rect`);
  }
  // Only horizontal, left-anchored clipping exists in the delivered pack.
  if (layout.clip_axis !== 'x' || layout.clip_origin !== 'left') {
    throw new AtlasFrameError(`Frame "${name}" uses an unsupported clip mode`);
  }
  return { fillRect: layout.fill_rect, clipAxis: 'x', clipOrigin: 'left' };
}

export function atlasFromSpritesheet(sheet: Spritesheet, label: string): Atlas {
  const frames: unknown = sheet.data.frames;
  return {
    texture(name) {
      const texture = sheet.textures[name];
      if (texture === undefined) throw new AtlasFrameError(`Atlas "${label}" has no frame "${name}"`);
      return texture;
    },
    fillLayout(name) {
      return parseFillLayout(isRecord(frames) ? frames[name] : undefined, name);
    },
    textureCount: Object.keys(sheet.textures).length,
  };
}
