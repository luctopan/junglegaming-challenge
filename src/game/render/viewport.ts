import type { Vec2 } from '../../shared/math/vec2';

/** World → screen transform: uniform scale + offset, in CSS pixels. */
export interface Viewport {
  readonly scale: number;
  readonly offsetX: number;
  readonly offsetY: number;
  /** Screen size the viewport was computed for (CSS px). */
  readonly screenWidth: number;
  readonly screenHeight: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

/**
 * Fits the whole arena into the screen ("contain") and centres it. The aspect
 * ratio is preserved, so the rules (arena bounds, distances) never change with
 * the window: only the scale does. The letterbox shows more water.
 */
export function fitViewport(screen: Size, world: Size): Viewport {
  const width = Math.max(0, screen.width);
  const height = Math.max(0, screen.height);
  const scale =
    world.width > 0 && world.height > 0 ? Math.min(width / world.width, height / world.height) : 0;
  return {
    scale,
    offsetX: (width - world.width * scale) / 2,
    offsetY: (height - world.height * scale) / 2,
    screenWidth: width,
    screenHeight: height,
  };
}

/** Screen (CSS px, relative to the canvas) → world units. Inverse of the stage transform. */
export function screenToWorld(viewport: Viewport, point: Vec2): Vec2 {
  if (viewport.scale === 0) return { x: 0, y: 0 };
  return {
    x: (point.x - viewport.offsetX) / viewport.scale,
    y: (point.y - viewport.offsetY) / viewport.scale,
  };
}

export function worldToScreen(viewport: Viewport, point: Vec2): Vec2 {
  return {
    x: point.x * viewport.scale + viewport.offsetX,
    y: point.y * viewport.scale + viewport.offsetY,
  };
}

/** World-space rectangle covered by the whole screen (arena plus letterbox). */
export function visibleWorldRect(viewport: Viewport): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const topLeft = screenToWorld(viewport, { x: 0, y: 0 });
  const scale = viewport.scale === 0 ? 1 : viewport.scale;
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: viewport.screenWidth / scale,
    height: viewport.screenHeight / scale,
  };
}

/**
 * Texture resolution worth loading: 2× art pays off once one world unit covers
 * more than one device pixel (high-DPI screens or large windows).
 */
export function preferredTextureResolution(devicePixelRatio: number, viewportScale: number): 1 | 2 {
  return devicePixelRatio * viewportScale > 1 ? 2 : 1;
}
