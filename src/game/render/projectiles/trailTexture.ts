import { BufferImageSource, Texture } from 'pixi.js';

const CHANNELS = 4;
const OPAQUE = 255;

/**
 * Horizontal alpha ramp, `steps` px wide and 1 px tall: transparent on the left
 * (the trail's tail), opaque white on the right (at the ball). Built from bytes,
 * so no canvas or renderer is needed; premultiplied, so colour = alpha.
 */
export function trailRampPixels(steps: number): Uint8Array {
  const data = new Uint8Array(steps * CHANNELS);
  for (let i = 0; i < steps; i++) {
    const alpha = Math.round((OPAQUE * (i + 1)) / steps);
    data.fill(alpha, i * CHANNELS, (i + 1) * CHANNELS);
  }
  return data;
}

/** One texture shared by every trail of a renderer; destroy it with the renderer. */
export function createTrailTexture(steps: number): Texture {
  const source = new BufferImageSource({
    resource: trailRampPixels(steps),
    width: steps,
    height: 1,
    alphaMode: 'premultiplied-alpha',
    scaleMode: 'linear',
  });
  return new Texture({ source });
}
