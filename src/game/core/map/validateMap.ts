import { ISLAND, WATER } from './arenaMap';
import { shoreShape } from './shoreShape';

/**
 * Checks an arena layout against the constraints that keep it drawable with the
 * provided shore tiles (each island cell maps to a fill, edge, outer or inner
 * corner tile, see `shoreShape`) and navigable (channels at least two tiles wide,
 * all water connected). Returns readable issues.
 */
export function validateMap(map: readonly string[]): string[] {
  const issues: string[] = [];
  const rows = map.length;
  const cols = map[0]?.length ?? 0;
  if (rows === 0 || cols === 0) return ['map is empty'];
  map.forEach((line, row) => {
    if (line.length !== cols) issues.push(`row ${row} has ${line.length} cells, expected ${cols}`);
    if (Array.from(line).some((ch) => ch !== WATER && ch !== ISLAND)) {
      issues.push(`row ${row} contains an unknown cell type`);
    }
  });
  if (issues.length > 0) return issues;

  const at = (col: number, row: number): string | undefined => map[row]?.[col];
  /** Top-left corners of the 2×2 windows containing (col, row); out-of-grid cells read as undefined. */
  const windowsOf = (col: number, row: number): [number, number][] => [
    [col - 1, row - 1],
    [col, row - 1],
    [col - 1, row],
    [col, row],
  ];
  const windowCells = (col: number, row: number): (string | undefined)[] => [
    at(col, row),
    at(col + 1, row),
    at(col, row + 1),
    at(col + 1, row + 1),
  ];
  const inUniformBlock = (col: number, row: number, kind: string): boolean =>
    windowsOf(col, row).some(([c, r]) => windowCells(c, r).every((cell) => cell === kind));

  const isIsland = (col: number, row: number): boolean => at(col, row) === ISLAND;
  let islandCells = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const kind = at(col, row) ?? WATER;
      if (kind === ISLAND) islandCells++;
      if (kind === ISLAND && shoreShape(isIsland, col, row).kind === 'unsupported') {
        issues.push(`island cell (${col},${row}) cannot be drawn with the shore tiles`);
      }
      if (!inUniformBlock(col, row, kind)) {
        issues.push(
          kind === ISLAND
            ? `island cell (${col},${row}) is not part of a 2×2 island block`
            : `water cell (${col},${row}) is in a channel narrower than 2 tiles`,
        );
      }
      const [a, b, c, d] = windowCells(col, row);
      if (d !== undefined && b !== undefined && c !== undefined && a === d && b === c && a !== b) {
        issues.push(`diagonal-only contact in the 2×2 block at (${col},${row})`);
      }
    }
  }
  if (islandCells === 0) issues.push('map has no island');
  if (!waterIsConnected(map, cols, rows)) issues.push('water cells are not all connected');
  return issues;
}

function waterIsConnected(map: readonly string[], cols: number, rows: number): boolean {
  const water: number[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++)
      if (map[row]?.[col] === WATER) water.push(row * cols + col);
  }
  const start = water[0];
  if (start === undefined) return false;
  const seen = new Set<number>([start]);
  const queue = [start];
  for (let index = queue.shift(); index !== undefined; index = queue.shift()) {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const neighbours: [number, number][] = [
      [col + 1, row],
      [col - 1, row],
      [col, row + 1],
      [col, row - 1],
    ];
    for (const [c, r] of neighbours) {
      const next = r * cols + c;
      if (c >= 0 && r >= 0 && c < cols && r < rows && map[r]?.[c] === WATER && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen.size === water.length;
}
