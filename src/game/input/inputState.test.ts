import { describe, expect, it } from 'vitest';
import { IDLE_INPUT } from '../core';
import { InputState } from './inputState';
import { keySource, pointerSource } from './keymap';

describe('InputState', () => {
  it('is idle with nothing pressed', () => {
    const state = new InputState();
    expect(state.idle).toBe(true);
    expect(state.sample()).toBe(IDLE_INPUT);
  });

  it('combines moving and firing from different sources at once', () => {
    const state = new InputState();
    state.press('forward', pointerSource(1));
    state.press('turnLeft', keySource('KeyA'));
    state.press('fireFront', pointerSource(2));
    expect(state.sample()).toEqual({
      forward: true,
      turn: -1,
      fireFront: true,
      fireLeft: false,
      fireRight: false,
    });
  });

  it('keeps an action held until its last source releases it', () => {
    const state = new InputState();
    state.press('forward', keySource('KeyW'));
    state.press('forward', keySource('ArrowUp'));
    state.sample();
    state.release('forward', keySource('KeyW'));
    expect(state.sample().forward).toBe(true);
    state.releaseSource(keySource('ArrowUp'));
    expect(state.sample().forward).toBe(false);
  });

  it('cancels opposite turns', () => {
    const state = new InputState();
    state.press('turnLeft', keySource('KeyA'));
    state.press('turnRight', keySource('KeyD'));
    expect(state.sample().turn).toBe(0);
    state.releaseSource(keySource('KeyA'));
    expect(state.sample().turn).toBe(1);
  });

  it('latches a tap released before the next step, exactly once', () => {
    const state = new InputState();
    state.press('fireLeft', pointerSource(7));
    state.releaseSource(pointerSource(7));
    expect(state.sample().fireLeft).toBe(true);
    expect(state.sample().fireLeft).toBe(false);
    expect(state.idle).toBe(true);
  });

  it('releases one finger without touching the others (multi-touch)', () => {
    const state = new InputState();
    state.press('forward', pointerSource(1));
    state.press('fireRight', pointerSource(2));
    state.sample();
    state.releaseSource(pointerSource(2));
    expect(state.sample()).toMatchObject({ forward: true, fireRight: false });
  });

  it('clear() forgets held and latched input (pause, blur, cancel)', () => {
    const state = new InputState();
    state.press('forward', keySource('KeyW'));
    state.press('fireFront', keySource('Space'));
    state.clear();
    expect(state.idle).toBe(true);
    expect(state.sample()).toBe(IDLE_INPUT);
    // The key is still physically down; its later release is harmless and nothing acts again.
    state.releaseSource(keySource('KeyW'));
    expect(state.sample()).toBe(IDLE_INPUT);
  });
});
