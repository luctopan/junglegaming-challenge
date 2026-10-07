// @ts-check
/**
 * Pure helpers that decide whether a vector rasterization can replace a raster
 * sprite sheet at a higher resolution: every frame of the raster sheet must be
 * found, at its sheet coordinates × scale, in the rasterized vector.
 * No file system access, so the decision is unit-testable.
 */

/**
 * @typedef {{ width: number, height: number, data: Uint8Array }} RgbaImage Straight (non-premultiplied) RGBA.
 * @typedef {{ x: number, y: number, w: number, h: number }} Rect
 * @typedef {{ name: string, error: number }} FrameError
 * @typedef {{
 *   aligned: boolean,
 *   reason: string,
 *   worst: FrameError | null,
 *   misaligned: number,
 *   frames: number,
 * }} AlignmentReport
 */

/**
 * Mean absolute difference per channel (0–255) between a raster frame and the
 * same frame of a `scale`× image box-filtered down to 1×, compared premultiplied
 * so differences in fully transparent pixels do not count.
 * @param {RgbaImage} sheet
 * @param {RgbaImage} scaled
 * @param {Rect} rect Frame in sheet pixels.
 * @param {number} scale Integer factor of `scaled` over `sheet`.
 */
export function frameError(sheet, scaled, rect, scale) {
  const samples = scale * scale;
  let total = 0;
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      const box = [0, 0, 0, 0];
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const sx = x * scale + dx;
          const sy = y * scale + dy;
          if (sx >= scaled.width || sy >= scaled.height) continue;
          const i = (sy * scaled.width + sx) * 4;
          const alpha = (scaled.data[i + 3] ?? 0) / 255;
          for (let c = 0; c < 3; c++) box[c] = (box[c] ?? 0) + (scaled.data[i + c] ?? 0) * alpha;
          box[3] = (box[3] ?? 0) + (scaled.data[i + 3] ?? 0);
        }
      }
      const j = (y * sheet.width + x) * 4;
      const alpha = (sheet.data[j + 3] ?? 0) / 255;
      for (let c = 0; c < 4; c++) {
        const expected = c === 3 ? (sheet.data[j + 3] ?? 0) : (sheet.data[j + c] ?? 0) * alpha;
        total += Math.abs((box[c] ?? 0) / samples - expected);
      }
    }
  }
  return total / (rect.w * rect.h * 4);
}

/**
 * Checks every frame of a raster sheet against a `scale`× rasterization.
 * @param {{
 *   sheet: RgbaImage,
 *   scaled: RgbaImage,
 *   frames: Record<string, Rect>,
 *   scale: number,
 *   tolerance: number,
 * }} input `tolerance` is the largest acceptable `frameError` per frame.
 * @returns {AlignmentReport}
 */
export function checkFrameAlignment({ sheet, scaled, frames, scale, tolerance }) {
  const names = Object.keys(frames);
  const expected = { w: sheet.width * scale, h: sheet.height * scale };
  const sizeNote =
    scaled.width === expected.w && scaled.height === expected.h
      ? ''
      : ` (vector raster is ${scaled.width}×${scaled.height}, expected ${expected.w}×${expected.h})`;

  /** @type {FrameError | null} */
  let worst = null;
  let misaligned = 0;
  for (const name of names) {
    const rect = /** @type {Rect} */ (frames[name]);
    const error = frameError(sheet, scaled, rect, scale);
    if (error > tolerance) misaligned++;
    if (worst === null || error > worst.error) worst = { name, error };
  }
  const aligned = names.length > 0 && misaligned === 0 && sizeNote === '';
  const reason = aligned
    ? `all ${names.length} frames match within ${tolerance}`
    : `${misaligned} of ${names.length} frames differ by more than ${tolerance}` +
      (worst ? `; worst ${worst.name} = ${worst.error.toFixed(1)}` : '') +
      sizeNote;
  return { aligned, reason, worst, misaligned, frames: names.length };
}
