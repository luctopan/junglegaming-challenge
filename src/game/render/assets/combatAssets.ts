import type { Spritesheet } from 'pixi.js';
import { Assets } from 'pixi.js';
import type { CombatAtlases } from './atlas';
import { atlasFromSpritesheet } from './atlas';

/**
 * Page-wide registry of the combat textures: loaded once, kept in Pixi's
 * cache and reused by every match (sessions never unload them). A failed load
 * leaves nothing cached, so calling `loadCombatAssets` again is a clean retry.
 */

export interface LoadCombatAssetsOptions {
  /** URL prefix of the generated `public/assets/` folder (e.g. `/assets/`). */
  readonly basePath: string;
  /** 2 picks the `@2x` variants where the manifest has them. Fixed by the first call. */
  readonly resolution: 1 | 2;
  /** Overall progress in [0, 1]. */
  readonly onProgress?: (progress: number) => void;
}

interface BundleAsset {
  readonly alias: string;
  readonly src: readonly string[];
}

const MANIFEST_URL = 'manifest.json';
const BUNDLE = 'combat';
const REQUIRED_ALIASES = ['ships', 'tiles', 'ui'] as const;
/** Share of the progress bar taken by the (tiny) manifest. */
const MANIFEST_SHARE = 0.05;

let initialized = false;
let bundleRegistered = false;
let loaded: CombatAtlases | null = null;
let inflight: Promise<CombatAtlases> | null = null;
const progressListeners = new Set<(progress: number) => void>();

export class AssetManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AssetManifestError';
  }
}

/** Validates the generated manifest and returns the combat bundle entries. */
export function parseCombatManifest(manifest: unknown): BundleAsset[] {
  const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
  const bundles = isObject(manifest) ? manifest.bundles : undefined;
  const bundle: unknown = Array.isArray(bundles)
    ? (bundles as unknown[]).find((b) => isObject(b) && b.name === BUNDLE)
    : undefined;
  const assets: unknown = isObject(bundle) ? bundle.assets : undefined;
  const valid =
    Array.isArray(assets) &&
    assets.every(
      (a: unknown) =>
        isObject(a) &&
        typeof a.alias === 'string' &&
        Array.isArray(a.src) &&
        a.src.every((s: unknown) => typeof s === 'string'),
    );
  if (!valid) throw new AssetManifestError(`${MANIFEST_URL} has no valid "${BUNDLE}" bundle`);
  const list = assets as BundleAsset[];
  const missing = REQUIRED_ALIASES.filter((alias) => !list.some((a) => a.alias === alias));
  if (missing.length > 0) throw new AssetManifestError(`${MANIFEST_URL} is missing ${missing.join(', ')}`);
  return list;
}

async function loadOnce(options: LoadCombatAssetsOptions): Promise<CombatAtlases> {
  const report = (progress: number): void => {
    for (const listener of progressListeners) listener(progress);
  };
  if (!initialized) {
    await Assets.init({
      basePath: options.basePath,
      texturePreference: { resolution: options.resolution, format: ['png'] },
    });
    initialized = true;
  }
  report(0);
  const manifest: unknown = await Assets.load(MANIFEST_URL);
  if (!bundleRegistered) {
    Assets.addBundle(
      BUNDLE,
      parseCombatManifest(manifest).map((a) => ({ alias: a.alias, src: [...a.src] })),
    );
    bundleRegistered = true;
  }
  report(MANIFEST_SHARE);
  const sheets = (await Assets.loadBundle(BUNDLE, (p) => {
    report(MANIFEST_SHARE + (1 - MANIFEST_SHARE) * p);
  })) as Record<(typeof REQUIRED_ALIASES)[number], Spritesheet>;
  return {
    ships: atlasFromSpritesheet(sheets.ships, 'ships'),
    tiles: atlasFromSpritesheet(sheets.tiles, 'tiles'),
    ui: atlasFromSpritesheet(sheets.ui, 'ui'),
  };
}

/**
 * Loads (or returns the already loaded) combat atlases. Concurrent callers
 * share one load and all receive progress; a rejection is never cached.
 */
export function loadCombatAssets(options: LoadCombatAssetsOptions): Promise<CombatAtlases> {
  if (loaded !== null) {
    options.onProgress?.(1);
    return Promise.resolve(loaded);
  }
  const { onProgress } = options;
  if (onProgress) progressListeners.add(onProgress);
  inflight ??= loadOnce(options).then(
    (atlases) => {
      loaded = atlases;
      inflight = null;
      return atlases;
    },
    (error: unknown) => {
      inflight = null;
      throw error;
    },
  );
  return inflight.finally(() => {
    if (onProgress) progressListeners.delete(onProgress);
  });
}

/** Number of atlas textures kept in the page-wide cache (constant once loaded). */
export function cachedTextureCount(): number {
  if (loaded === null) return 0;
  return loaded.ships.textureCount + loaded.tiles.textureCount + loaded.ui.textureCount;
}
