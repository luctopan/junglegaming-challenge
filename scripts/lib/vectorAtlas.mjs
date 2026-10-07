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
export const frameError = (sheet, scaled, rect, scale) =>
  frameErrorAt(sheet, scaled, rect, scale, rect.x * scale, rect.y * scale);

/**
 * `frameError` with the frame looked up at (`originX`, `originY`) of the scaled
 * image instead of at its sheet position (pixels outside the image count as transparent).
 * @param {RgbaImage} sheet
 * @param {RgbaImage} scaled
 * @param {Rect} rect
 * @param {number} scale
 * @param {number} originX
 * @param {number} originY
 */
export function frameErrorAt(sheet, scaled, rect, scale, originX, originY) {
  const samples = scale * scale;
  let total = 0;
  for (let y = 0; y < rect.h; y++) {
    for (let x = 0; x < rect.w; x++) {
      const box = [0, 0, 0, 0];
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const sx = originX + x * scale + dx;
          const sy = originY + y * scale + dy;
          if (sx < 0 || sy < 0 || sx >= scaled.width || sy >= scaled.height) continue;
          const i = (sy * scaled.width + sx) * 4;
          const alpha = (scaled.data[i + 3] ?? 0) / 255;
          for (let c = 0; c < 3; c++) box[c] = (box[c] ?? 0) + (scaled.data[i + c] ?? 0) * alpha;
          box[3] = (box[3] ?? 0) + (scaled.data[i + 3] ?? 0);
        }
      }
      const j = ((rect.y + y) * sheet.width + rect.x + x) * 4;
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

/**
 * Builds a `scale`× sheet in the same layout as `sheet`: each frame is cropped
 * from the vector raster at its located position (`located`, in 1× vector
 * units, multiples of 1/scale), or, if it was not located, upscaled from the
 * 1× sheet (nearest neighbour, so it still downsamples to the exact 1× frame).
 * @param {{
 *   sheet: RgbaImage,
 *   raster: RgbaImage,
 *   frames: Record<string, Rect>,
 *   located: Record<string, { x: number, y: number }>,
 *   scale: number,
 * }} input
 * @returns {{ image: RgbaImage, upscaled: string[] }}
 */
export function composeScaledSheet({ sheet, raster, frames, located, scale }) {
  const width = sheet.width * scale;
  const height = sheet.height * scale;
  const data = new Uint8Array(width * height * 4);
  /** @type {string[]} */
  const upscaled = [];
  for (const [name, rect] of Object.entries(frames)) {
    const at = located[name];
    if (at === undefined) upscaled.push(name);
    for (let y = 0; y < rect.h * scale; y++) {
      for (let x = 0; x < rect.w * scale; x++) {
        const to = ((rect.y * scale + y) * width + rect.x * scale + x) * 4;
        if (at === undefined) {
          const from =
            ((rect.y + Math.floor(y / scale)) * sheet.width + rect.x + Math.floor(x / scale)) * 4;
          data.set(sheet.data.subarray(from, from + 4), to);
          continue;
        }
        const sx = Math.round(at.x * scale) + x;
        const sy = Math.round(at.y * scale) + y;
        if (sx < 0 || sy < 0 || sx >= raster.width || sy >= raster.height) continue;
        const from = (sy * raster.width + sx) * 4;
        data.set(raster.data.subarray(from, from + 4), to);
      }
    }
  }
  return { image: { width, height, data }, upscaled: upscaled.sort() };
}
