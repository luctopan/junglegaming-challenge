import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';

/**
 * WCAG text contrast of the UI palette against the art it is drawn on. Axe
 * cannot see background images, so the panel and button colours are sampled
 * from the atlas PNGs here and every text token is checked against them.
 */
const root = path.resolve(import.meta.dirname, '../..');
const tokens = readFileSync(path.join(root, 'src/ui/styles/tokens.css'), 'utf8');

type Rgb = readonly [number, number, number];

function token(name: string): Rgb {
  const match = new RegExp(`--color-${name}:\\s*#([0-9a-f]{6});`, 'i').exec(tokens);
  if (match?.[1] === undefined) throw new Error(`Token --color-${name} missing or not #rrggbb`);
  const hex = match[1];
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as unknown as Rgb;
}

const channel = (value: number): number => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = ([r, g, b]: Rgb): number =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Pixels of a PNG region (opaque ones only). */
function pixels(file: string, region: { x: number; y: number; w: number; h: number }): Rgb[] {
  const png = PNG.sync.read(readFileSync(path.join(root, 'assets/png/default/ui', file)));
  const out: Rgb[] = [];
  for (let y = region.y; y < region.y + region.h; y++) {
    for (let x = region.x; x < region.x + region.w; x++) {
      const i = (y * png.width + x) * 4;
      if ((png.data[i + 3] ?? 0) === 255) {
        out.push([png.data[i] ?? 0, png.data[i + 1] ?? 0, png.data[i + 2] ?? 0]);
      }
    }
  }
  return out;
}

/**
 * Pixel at a luminance percentile: ignores the few specks of texture noise
 * and anti-aliased rim pixels that no glyph is drawn over.
 */
function percentile(list: readonly Rgb[], q: number): Rgb {
  const sorted = [...list].sort((a, b) => luminance(a) - luminance(b));
  const pixel = sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  if (pixel === undefined) throw new Error('empty region');
  return pixel;
}
const lightest = (list: readonly Rgb[]): Rgb => percentile(list, 0.99);
const darkest = (list: readonly Rgb[]): Rgb => percentile(list, 0.01);

const AA_TEXT = 4.5;

describe('UI contrast (WCAG AA, 4.5:1 for text)', () => {
  // Inside panel_menu's content_rect, clear of its inner bevel: the navy behind panel text.
  const panelArt = pixels('menu/panel_menu.png', { x: 40, y: 48, w: 304, h: 384 });

  it('the light panel token is at least as light as the panel art', () => {
    expect(luminance(token('panel-light'))).toBeGreaterThanOrEqual(luminance(lightest(panelArt)));
  });

  it.each(['text', 'heading', 'text-muted', 'label', 'gold', 'danger', 'success'])(
    '--color-%s on the panel, table rows and the highlighted row',
    (name) => {
      for (const background of ['panel-light', 'row', 'row-highlight']) {
        expect(
          contrast(token(name), token(background)),
          `${name} on ${background}`,
        ).toBeGreaterThanOrEqual(AA_TEXT);
      }
    },
  );

  /** `filter: brightness()` applied to the pressed primary art (Button.module.css). */
  const PRESSED_BRIGHTNESS = 1.18;
  const brighten = ([r, g, b]: Rgb): Rgb =>
    [r, g, b].map((c) => Math.min(255, c * PRESSED_BRIGHTNESS)) as unknown as Rgb;

  it.each(['normal', 'hover', 'pressed'])('button label on the primary %s art', (state) => {
    // Centre of label_rect (ui.layout), clear of the inner bevel lines.
    const raw = pixels(`menu/button_primary_${state}.png`, { x: 48, y: 28, w: 160, h: 30 });
    const art = state === 'pressed' ? raw.map(brighten) : raw;
    expect(contrast(token('button-text'), darkest(art))).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast(token('button-text'), lightest(art))).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each(['normal', 'pressed'])('panel text on the secondary %s art', (state) => {
    const art = pixels(`menu/button_secondary_${state}.png`, { x: 48, y: 28, w: 160, h: 30 });
    expect(contrast(token('text'), lightest(art))).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('HUD counter text on the counter panel', () => {
    const art = pixels('hud/counter_panel.png', { x: 16, y: 14, w: 128, h: 28 });
    expect(contrast(token('text'), lightest(art))).toBeGreaterThanOrEqual(AA_TEXT);
  });
});
