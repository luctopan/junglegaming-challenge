/** `health_frame` is 256 px wide; its fill_rect starts at x 30 and is 196 px wide (ui.layout). */
const FRAME_WIDTH = 256;
const FILL_X = 30;
const FILL_WIDTH = 196;

/**
 * Right inset, in percent of the frame, that clips the fill sprite to the HP
 * ratio (clip_axis x, clip_origin left): the frame keeps its size, so the
 * same percentage works at any HUD scale and for the 1× and 2× art.
 */
export function fillClipRight(hp: number, maxHp: number): number {
  const ratio = maxHp > 0 ? Math.min(1, Math.max(0, hp / maxHp)) : 0;
  return ((FRAME_WIDTH - FILL_X - FILL_WIDTH * ratio) / FRAME_WIDTH) * 100;
}
