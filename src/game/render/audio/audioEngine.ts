import type { DomainEvent } from '../../core';
import { trackResource } from '../../../platform/resourceCounters';
import type { SoundCue } from './soundCues';
import { SOUND_CUES, SOUND_FILES, soundCuesFor } from './soundCues';

/**
 * WebAudio playback of the delivered WAVs. The browser only lets audio start
 * after a user gesture, so nothing is created or fetched until `unlock()` is
 * called from one (or when the page already had one). Audio is optional: a
 * missing context or a failed download just means silence, never an error
 * that blocks the game.
 *
 * The context and the decoded buffers are page-wide (decoded once, like the
 * textures); each session owns only the sources it starts and stops them on
 * `destroy()`.
 */

interface AudioBank {
  readonly context: AudioContext;
  readonly buffers: Map<string, AudioBuffer>;
}

let bank: AudioBank | null = null;
let warned = false;

function warnOnce(message: string, error: unknown): void {
  if (warned) return;
  warned = true;
  console.warn(message, error);
}

function openBank(basePath: string): AudioBank | null {
  if (bank !== null) return bank;
  if (typeof AudioContext === 'undefined') return null;
  const context = new AudioContext();
  const buffers = new Map<string, AudioBuffer>();
  bank = { context, buffers };
  // Decode in the background; cues simply stay silent until their buffer is ready.
  for (const file of SOUND_FILES) {
    fetch(`${basePath}sounds/${file}.wav`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${file}.wav`);
        return response.arrayBuffer();
      })
      .then((data) => context.decodeAudioData(data))
      .then((buffer) => buffers.set(file, buffer))
      .catch((error: unknown) => {
        warnOnce('Some sounds could not be loaded; the game continues without them.', error);
      });
  }
  return bank;
}

export interface AudioEngine {
  /** Call from a user gesture (or once the page has had one). Idempotent. */
  unlock(): void;
  playEvents(events: readonly DomainEvent[], playerId: number): void;
  play(cue: SoundCue): void;
  startAmbience(): void;
  setMuted(muted: boolean): void;
  readonly muted: boolean;
  /** Stops every source this engine started. */
  destroy(): void;
}

export interface AudioEngineOptions {
  readonly basePath: string;
  readonly muted: boolean;
}

export function createAudioEngine({
  basePath,
  muted: initiallyMuted,
}: AudioEngineOptions): AudioEngine {
  let muted = initiallyMuted;
  let output: { context: AudioContext; gain: GainNode } | null = null;
  let ambience: { source: AudioBufferSourceNode; release: () => void } | null = null;
  let wantsAmbience = false;
  let destroyed = false;
  const variant = new Map<SoundCue, number>();

  const ensureOutput = (): {
    context: AudioContext;
    gain: GainNode;
    buffers: Map<string, AudioBuffer>;
  } | null => {
    if (destroyed || bank === null) return null;
    if (output === null) {
      const gain = bank.context.createGain();
      gain.gain.value = muted ? 0 : 1;
      gain.connect(bank.context.destination);
      output = { context: bank.context, gain };
    }
    return { ...output, buffers: bank.buffers };
  };

  const startSource = (cue: SoundCue, loop: boolean): AudioBufferSourceNode | null => {
    const out = ensureOutput();
    if (out === null) return null;
    const { files, gain } = SOUND_CUES[cue];
    // Round-robin over the variants: deterministic, and never the same shot twice in a row.
    const index = variant.get(cue) ?? 0;
    variant.set(cue, (index + 1) % files.length);
    const buffer = out.buffers.get(files[index] ?? files[0]);
    if (buffer === undefined) return null;
    const source = out.context.createBufferSource();
    const cueGain = out.context.createGain();
    cueGain.gain.value = gain;
    source.buffer = buffer;
    source.loop = loop;
    source.connect(cueGain).connect(out.gain);
    source.start();
    return source;
  };

  const tryStartAmbience = (): void => {
    if (!wantsAmbience || ambience !== null) return;
    const source = startSource('ambience', true);
    if (source !== null) ambience = { source, release: trackResource('audioLoops') };
  };

  return {
    unlock() {
      if (destroyed) return;
      const opened = openBank(basePath);
      if (opened === null) return;
      opened.context.resume().catch((error: unknown) => {
        warnOnce('Audio could not start; the game continues without sound.', error);
      });
      tryStartAmbience();
    },
    playEvents(events, playerId) {
      if (muted || bank === null) return;
      for (const event of events)
        for (const cue of soundCuesFor(event, playerId)) startSource(cue, false);
      // The ambience buffer may finish decoding after the match started.
      tryStartAmbience();
    },
    play(cue) {
      if (!muted) startSource(cue, false);
    },
    startAmbience() {
      wantsAmbience = true;
      tryStartAmbience();
    },
    setMuted(value) {
      muted = value;
      if (output !== null) output.gain.gain.value = value ? 0 : 1;
    },
    get muted() {
      return muted;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (ambience !== null) {
        ambience.source.stop();
        ambience.source.disconnect();
        ambience.release();
        ambience = null;
      }
      output?.gain.disconnect();
      output = null;
    },
  };
}
