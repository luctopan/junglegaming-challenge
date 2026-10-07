import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { healSeams } from '../../scripts/lib/atlas.mjs';
import { ISLAND_BLOCK, ISLAND_BLOCK_SEAMS } from '../../scripts/lib/islandBlock.mjs';
import { ISLAND_BLOCK as RENDER_BLOCK } from '../../src/game/render/theme';

const sheets = path.resolve(import.meta.dirname, '../../assets/tilesheet');

interface Image {
  width: number;
  height: number;
  data: Uint8Array;
}

/** Mean colour step (0–255) across the shared border of a and b, over pixels opaque on both sides. */
function seamStep(sheet: Image, tile: number, a: number, b: number, axis: 'x' | 'y'): number {
  const cols = sheet.width / tile;
  const at = (id: number, x: number, y: number) =>
    ((Math.floor((id - 1) / cols) * tile + y) * sheet.width + ((id - 1) % cols) * tile + x) * 4;
  let total = 0;
  let count = 0;
  for (let i = 0; i < tile; i++) {
    const pa = axis === 'x' ? at(a, tile - 1, i) : at(a, i, tile - 1);
    const pb = axis === 'x' ? at(b, 0, i) : at(b, i, 0);
    if ((sheet.data[pa + 3] ?? 0) < 250 || (sheet.data[pb + 3] ?? 0) < 250) continue;
    for (let c = 0; c < 3; c++)
      total += Math.abs((sheet.data[pa + c] ?? 0) - (sheet.data[pb + c] ?? 0));
    count += 3;
  }
  return count === 0 ? 0 : total / count;
}

describe('painted island block', () => {
  it('is the same block the renderer indexes', () => {
    expect(ISLAND_BLOCK).toEqual(RENDER_BLOCK.tiles);
  });

  it.each([
    { file: 'tiles_sheet.png', tile: 64, width: 8 },
    { file: 'tiles_sheet_retina.png', tile: 128, width: 16 },
  ])(
    'has no visible colour step between its tiles after healing ($file)',
    ({ file, tile, width }) => {
      const sheet = PNG.sync.read(readFileSync(path.join(sheets, file)));
      const before = Math.max(
        ...ISLAND_BLOCK_SEAMS.map((s) => seamStep(sheet, tile, s.a, s.b, s.axis)),
      );
      healSeams(sheet, tile, ISLAND_BLOCK_SEAMS, width);
      const after = ISLAND_BLOCK_SEAMS.map((s) => seamStep(sheet, tile, s.a, s.b, s.axis));
      // The delivered art steps up to ~10/255 on some borders; healed, every border is ≤ 1.
      expect(before).toBeGreaterThan(8);
      expect(Math.max(...after)).toBeLessThanOrEqual(1);
    },
  );
});
