import { describe, expect, it } from 'vitest';
import { findDevOnlyCode } from '../../scripts/lib/devOnly.mjs';

describe('findDevOnlyCode (scripts/verify-dist.mjs)', () => {
  it('accepts a clean bundle', () => {
    expect(
      findDevOnlyCode([
        { file: 'index.html', content: '<script src="static/index.js"></script>' },
        { file: 'static/index.js', content: 'console.log("menu")' },
      ]),
    ).toEqual([]);
  });

  it('flags the dev config override module by its source-map path', () => {
    expect(
      findDevOnlyCode([
        {
          file: 'static/GameScreen.js.map',
          content: '{"sources":["../../src/config/configOverrides.ts"]}',
        },
      ]),
    ).toEqual(['static/GameScreen.js.map: contains dev config override module']);
  });

  it('flags override code in emitted JS but not the dead branch kept in a source map', () => {
    const code = 'console.warn(`[dev config] Balance overrides active: ${a}`)';
    expect(findDevOnlyCode([{ file: 'static/GameScreen.js', content: code }])).toEqual([
      'static/GameScreen.js: contains dev config override code',
    ]);
    expect(findDevOnlyCode([{ file: 'static/GameScreen.js.map', content: code }])).toEqual([]);
  });

  it('still flags the sandbox and test bots', () => {
    expect(
      findDevOnlyCode([
        { file: 'sandbox.html', content: '' },
        { file: 'static/a.js.map', content: 'src/game/core/testing/bots.ts' },
      ]),
    ).toEqual([
      'sandbox.html: dev-only page',
      'static/a.js.map: contains scripted test bot module',
    ]);
  });
});
