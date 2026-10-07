import { describe, expect, it } from 'vitest';
import { fromAngle, length } from '../../../shared/math/vec2';
import type { DomainEvent } from '../events';
import { getPlayer } from '../ships';
import { step } from '../step';
import { configWith, input, ofType, place, quietWorld, run, stepsFor } from '../testing/fixtures';
import { OPEN_MAP } from '../testing/maps';
import type { Projectile, Team, World } from '../types';
import { IDLE_INPUT } from '../types';
import { cannonFor } from './weapons';

const open = (): World => quietWorld(undefined, { map: OPEN_MAP });

/** Player in open water at the bottom of the arena, facing right (+x). */
function openFacingRight(x = 300, y = 500): World {
  const world = open();
  const player = getPlayer(world);
  player.pos = { x, y };
  player.heading = 0;
  return world;
}

function launch(
  world: World,
  team: Team,
  pos: { x: number; y: number },
  heading: number,
  speed = 420,
  damage = 10,
): Projectile {
  const projectile: Projectile = {
    id: world.nextId++,
    ownerId: -1,
    team,
    cannon: 'shooterCannon',
    pos,
    prevPos: pos,
    vel: fromAngle(heading, speed),
    damage,
    distanceLeft: 380,
    alive: true,
  };
  world.projectiles.push(projectile);
  return projectile;
}

describe('weapons', () => {
  it('front cannon fires one ball forward from the bow', () => {
    const world = openFacingRight();
    const events = step(world, input({ fireFront: true }));
    const [shot] = ofType(events, 'shotFired');
    expect(shot?.slot).toBe('front');
    expect(shot?.muzzles).toHaveLength(1);
    expect(world.projectiles).toHaveLength(1);
    const ball = world.projectiles[0];
    expect(ball?.vel.x).toBeCloseTo(420);
    expect(ball?.vel.y).toBeCloseTo(0);
    expect(ball?.damage).toBe(20);
  });

  it.each([
    ['left', -1],
    ['right', 1],
  ] as const)('%s broadside fires three parallel balls perpendicular to the hull', (side, sign) => {
    const world = openFacingRight();
    const events = step(world, input(side === 'left' ? { fireLeft: true } : { fireRight: true }));
    expect(ofType(events, 'shotFired')[0]?.muzzles).toHaveLength(3);
    expect(world.projectiles).toHaveLength(3);
    for (const ball of world.projectiles) {
      expect(ball.vel.x).toBeCloseTo(0);
      expect(Math.sign(ball.vel.y)).toBe(sign);
      expect(ball.damage).toBe(15);
    }
    // Spread along the hull axis (x), 28 u apart, centred on the ship.
    const xs = world.projectiles.map((b) => b.prevPos.x).sort((a, b) => a - b);
    expect(xs[1]! - xs[0]!).toBeCloseTo(28); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- length asserted above
    expect(xs[2]! - xs[1]!).toBeCloseTo(28); // eslint-disable-line @typescript-eslint/no-non-null-assertion -- length asserted above
  });

  it('respects each weapon cooldown while fire is held', () => {
    const world = openFacingRight(100);
    const events = run(world, stepsFor(world, 1), input({ fireFront: true }));
    // t = 0 (first step), 0.5, 1.0 → shots at steps 1, 31, 61: only two inside 60 steps.
    expect(ofType(events, 'shotFired')).toHaveLength(2);
    const more = run(world, 1, input({ fireFront: true }));
    expect(ofType(more, 'shotFired')).toHaveLength(1);
  });

  it('left and right broadsides have independent cooldowns', () => {
    const world = openFacingRight();
    run(world, 1, input({ fireLeft: true }));
    const events = run(world, 1, input({ fireLeft: true, fireRight: true }));
    expect(ofType(events, 'shotFired').map((e) => e.slot)).toEqual(['right']);
  });

  it('chasers have no cannons; shooters only a front one', () => {
    const world = open();
    const chaser = place(world, 'chaser', { x: 100, y: 100 });
    const shooter = place(world, 'shooter', { x: 900, y: 100 });
    expect(cannonFor(chaser, 'front')).toBeNull();
    expect(cannonFor(shooter, 'front')).toBe('shooterCannon');
    expect(cannonFor(shooter, 'left')).toBeNull();
  });
});

describe('projectiles', () => {
  it('fly at their speed and disappear at max range', () => {
    const world = openFacingRight(100);
    step(world, input({ fireFront: true }));
    const ball = world.projectiles[0];
    expect(ball && length({ x: ball.pos.x - ball.prevPos.x, y: 0 })).toBeCloseTo(7);
    const events = run(world, stepsFor(world, 1));
    const [expired] = ofType(events, 'projectileExpired');
    expect(expired?.reason).toBe('range');
    // Muzzle at x = 156, range 380.
    expect(expired?.pos.x).toBeCloseTo(536);
    expect(world.projectiles).toHaveLength(0);
  });

  it('are removed when leaving the arena', () => {
    const world = openFacingRight(800);
    step(world, input({ fireFront: true }));
    const [expired] = ofType(run(world, stepsFor(world, 1)), 'projectileExpired');
    expect(expired?.reason).toBe('outOfArena');
  });

  it('are blocked by islands', () => {
    const world = open();
    // Default spawn (512, 448) faces up at the island bottom (y = 320).
    step(world, input({ fireFront: true }));
    const [blocked] = ofType(run(world, stepsFor(world, 1)), 'projectileBlocked');
    expect(blocked?.pos.y).toBeCloseTo(325);
    expect(world.projectiles).toHaveLength(0);
  });

  it('damage an enemy exactly once and are removed on hit', () => {
    const world = openFacingRight(100);
    const shooter = place(world, 'shooter', { x: 400, y: 500 }, Math.PI / 2);
    step(world, input({ fireFront: true }));
    const events = run(world, stepsFor(world, 1));
    expect(ofType(events, 'projectileHit')).toHaveLength(1);
    expect(ofType(events, 'shipDamaged')).toEqual([
      expect.objectContaining({ shipId: shooter.id, amount: 20, hp: 30 }),
    ]);
    expect(world.projectiles.filter((p) => p.team === 'player')).toHaveLength(0);
  });

  it('never hit their own team: player balls pass the player, enemy balls pass enemies', () => {
    const world = openFacingRight(600);
    const player = getPlayer(world);
    launch(world, 'player', { x: 500, y: 500 }, 0);
    const chaser = place(world, 'chaser', { x: 300, y: 500 }, Math.PI / 2);
    launch(world, 'enemy', { x: 250, y: 500 }, 0);
    const events = run(world, stepsFor(world, 0.8));
    expect(chaser.hp).toBe(30);
    const hits = ofType(events, 'projectileHit');
    expect(hits.map((h) => h.targetId)).toEqual([player.id]);
    expect(player.hp).toBe(player.maxHp - 10);
  });

  it('use swept collision: a very fast ball cannot tunnel through a ship', () => {
    const world = openFacingRight(100);
    const target = place(world, 'shooter', { x: 600, y: 500 }, Math.PI / 2);
    launch(world, 'player', { x: 200, y: 500 }, 0, 60000, 5);
    step(world, IDLE_INPUT);
    expect(target.hp).toBe(45);
  });

  it('hit a ship broadside-on through the middle of the hull (no gap between hull circles)', () => {
    const world = openFacingRight(100);
    const target = place(world, 'chaser', { x: 400, y: 500 }, Math.PI / 2);
    // Exactly between the two circle centres: the weakest spot of the hull shape.
    launch(world, 'player', { x: 200, y: 500 }, 0);
    run(world, stepsFor(world, 0.6));
    expect(target.hp).toBe(20);
  });

  it('kill and score once when several balls hit a dying ship in the same step', () => {
    const world = openFacingRight(512, 520);
    const target = place(world, 'shooter', { x: 512, y: 400 }, 0);
    target.hp = 1;
    const events: DomainEvent[] = [];
    events.push(...step(world, input({ fireLeft: true })));
    events.push(...run(world, stepsFor(world, 0.3)));
    expect(ofType(events, 'shipDestroyed')).toHaveLength(1);
    expect(ofType(events, 'projectileHit')).toHaveLength(1);
    expect(ofType(events, 'scoreChanged')).toEqual([expect.objectContaining({ score: 1 })]);
    expect(world.score).toBe(1);
  });
});

describe('damage and destruction', () => {
  it('a destroyed enemy stops firing, colliding and taking hits, then sinks away', () => {
    const cfg = configWith((c) => {
      c.damage.wreckSeconds = 0.5;
    });
    const world = quietWorld(cfg, { map: OPEN_MAP });
    const player = getPlayer(world);
    player.pos = { x: 100, y: 500 };
    player.heading = 0;
    const enemy = place(world, 'shooter', { x: 300, y: 500 }, Math.PI);
    enemy.hp = 20;
    step(world, input({ fireFront: true }));
    run(world, stepsFor(world, 0.3));
    expect(enemy.alive).toBe(false);
    expect(world.score).toBe(1);
    const shotsAfter = run(world, stepsFor(world, 0.15), input({ fireFront: false }));
    expect(ofType(shotsAfter, 'shotFired')).toHaveLength(0);
    launch(world, 'player', { x: 250, y: 500 }, 0);
    const passing = run(world, stepsFor(world, 0.2));
    expect(ofType(passing, 'projectileHit')).toHaveLength(0);
    run(world, stepsFor(world, 0.5));
    expect(world.ships.map((s) => s.id)).toEqual([player.id]);
  });

  it('chaser ramming the player explodes, deals ram damage and scores nothing', () => {
    const world = open();
    const player = getPlayer(world);
    player.pos = { x: 300, y: 500 };
    const chaser = place(world, 'chaser', { x: 300, y: 380 }, Math.PI / 2);
    const events = run(world, stepsFor(world, 3));
    expect(ofType(events, 'chaserRammed')).toHaveLength(1);
    expect(chaser.alive).toBe(false);
    expect(ofType(events, 'shipDestroyed')).toEqual([
      expect.objectContaining({ shipId: chaser.id, cause: 'ram', killerTeam: 'enemy' }),
    ]);
    expect(player.hp).toBe(player.maxHp - world.cfg.chaser.ramDamage);
    expect(world.score).toBe(0);
    expect(ofType(events, 'scoreChanged')).toHaveLength(0);
  });

  it('the player wreck stays in the world after defeat', () => {
    const world = open();
    const player = getPlayer(world);
    player.hp = 5;
    player.pos = { x: 300, y: 500 };
    place(world, 'chaser', { x: 300, y: 400 }, Math.PI / 2);
    run(world, stepsFor(world, 3));
    expect(world.phase).toBe('ended');
    expect(world.ships).toContain(player);
  });
});
