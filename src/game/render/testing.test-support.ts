import { Rectangle, Texture, TextureSource } from 'pixi.js';
import type { Atlas, CombatAtlases, FillLayout } from './assets/atlas';

/**
 * Stand-in atlases for renderer unit tests in Node (no GPU): every frame name
 * resolves to a texture of a plausible size over one shared fake source, and
 * every frame has the enemy bar's fill layout.
 */
const SOURCE_SIZE = 1024;
const FRAME = { w: 160, h: 40 };
export const FAKE_FILL_LAYOUT: FillLayout = {
  fillRect: { x: 24, y: 12, w: 112, h: 15 },
  clipAxis: 'x',
  clipOrigin: 'left',
};

export function fakeAtlas(): Atlas & { readonly requested: Set<string> } {
  const source = new TextureSource({ width: SOURCE_SIZE, height: SOURCE_SIZE });
  const textures = new Map<string, Texture>();
  const requested = new Set<string>();
  return {
    requested,
    texture(name) {
      requested.add(name);
      let texture = textures.get(name);
      if (texture === undefined) {
        texture = new Texture({ source, frame: new Rectangle(0, 0, FRAME.w, FRAME.h) });
        textures.set(name, texture);
      }
      return texture;
    },
    fillLayout: () => FAKE_FILL_LAYOUT,
    textureCount: 0,
  };
}

export const fakeAtlases = (): CombatAtlases & {
  readonly ships: ReturnType<typeof fakeAtlas>;
  readonly tiles: ReturnType<typeof fakeAtlas>;
  readonly ui: ReturnType<typeof fakeAtlas>;
} => ({ ships: fakeAtlas(), tiles: fakeAtlas(), ui: fakeAtlas() });
