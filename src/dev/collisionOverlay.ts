import { Graphics } from 'pixi.js';
import type { Container } from 'pixi.js';
import type { WorldView } from '../game/render';

const RECT_COLOR = 0xff3b30;
const HULL_COLOR = 0xffeb3b;
const LINE = 1.5;
const ALPHA = 0.9;

/**
 * Draws the collision geometry over the art (island rects, hull circles,
 * projectile radii), to tune `arena.islandCollisionInset` and
 * `arena.islandCornerRadius` by eye.
 */
export function attachCollisionOverlay(layer: Container): {
  draw(world: WorldView): void;
  destroy(): void;
} {
  const g = new Graphics();
  layer.addChild(g);
  return {
    draw(world) {
      g.clear();
      for (const r of world.arena.islandRects) {
        const { topLeft, topRight, bottomLeft, bottomRight } = r.radii;
        g.moveTo(r.minX + topLeft, r.minY)
          .arcTo(r.maxX, r.minY, r.maxX, r.maxY, topRight)
          .arcTo(r.maxX, r.maxY, r.minX, r.maxY, bottomRight)
          .arcTo(r.minX, r.maxY, r.minX, r.minY, bottomLeft)
          .arcTo(r.minX, r.minY, r.maxX, r.minY, topLeft)
          .closePath();
      }
      g.stroke({ width: LINE, color: RECT_COLOR, alpha: ALPHA });
      for (const ship of world.ships) {
        if (!ship.alive) continue;
        const { circleRadius, circleOffset } = world.cfg.ships[ship.kind].hull;
        for (const sign of [1, -1]) {
          g.circle(
            ship.pos.x + Math.cos(ship.heading) * circleOffset * sign,
            ship.pos.y + Math.sin(ship.heading) * circleOffset * sign,
            circleRadius,
          );
        }
      }
      for (const p of world.projectiles) {
        if (p.alive) g.circle(p.pos.x, p.pos.y, world.cfg.projectile.radius);
      }
      g.stroke({ width: LINE, color: HULL_COLOR, alpha: ALPHA });
    },
    destroy() {
      // The session may already have destroyed the layer (and this child) on teardown.
      if (!g.destroyed) g.destroy();
    },
  };
}
