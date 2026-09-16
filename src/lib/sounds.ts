/**
 * MeMyMate by ARCT — Live Web Audio Sound Engine.
 *
 * Zero audio files: every sound effect in the app is synthesized on the fly
 * with the Web Audio API (oscillators, noise buffers and gain envelopes).
 * Sound settings (toggle + volume) persist in localStorage and are exposed
 * through a tiny pub/sub so the Settings page stays in sync.
 */

export type SoundName =
  | 'click' // crisp UI click
  | 'tap' // soft card tap (legacy)
  | 'flip' // card flip swoosh
  | 'tick' // countdown timer tick
  | 'correct' // correct answer chime
  | 'error' // error / time-out buzz
  | 'transition' // topic screen transition
  | 'win' // small victory (share copied, etc.)
  | 'levelup' // level-up arpeggio
  | 'fanfare' // triumphant completion fanfare
  | 'complete'; // legacy alias for fanfare

export type SoundSettings = { enabled: boolean; volume: number };

const ENABLED_KEY = 'memy-mate-sound-enabled-v1';
const VOLUME_KEY = 'memy-mate-sound-volume-v1';
const DEFAULT_SETTINGS: SoundSettings = { enabled: true, volume: 0.7 };

let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let settings: SoundSettings = readSettings();
const listeners = new Set<(next: SoundSettings) => void>();

function readSettings(): SoundSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
  try {
    const enabled = window.localStorage.getItem(ENABLED_KEY);
    const volume = window.localStorage.getItem(VOLUME_KEY);
    const parsedVolume = volume === null ? NaN : Number(volume);
    return {
      enabled: enabled === null ? DEFAULT_SETTINGS.enabled : enabled === 'true',
      volume: Number.isFinite(parsedVolume) ? Math.min(1, Math.max(0, parsedVolume)) : DEFAULT_SETTINGS.volume,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function persistSettings(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ENABLED_KEY, String(settings.enabled));
    window.localStorage.setItem(VOLUME_KEY, String(settings.volume));
  } catch {
    // Storage unavailable — settings stay for this session only.
  }
}

function emitSettings(): void {
  for (const listener of listeners) listener({ ...settings });
}

function applyMasterVolume(): void {
  if (!audioContext || !masterGain) return;
  masterGain.gain.setTargetAtTime(settings.enabled ? settings.volume : 0, audioContext.currentTime, 0.015);
}

type Engine = { context: AudioContext; master: GainNode };

function getEngine(): Engine | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!audioContext || !masterGain) {
    audioContext = new AudioContextClass();
    masterGain = audioContext.createGain();
    masterGain.connect(audioContext.destination);
    applyMasterVolume();
  }
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => undefined);
  return { context: audioContext, master: masterGain };
}

function getNoiseBuffer(context: AudioContext): AudioBuffer {
  noiseBuffer ??= (() => {
    const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) channel[index] = Math.random() * 2 - 1;
    return buffer;
  })();
  return noiseBuffer;
}

type ToneOptions = {
  frequency: number;
  start?: number;
  duration?: number;
  type?: OscillatorType;
  gain?: number;
  endFrequency?: number;
  attack?: number;
  detune?: number;
};

/** A single oscillator with an exponential attack/decay envelope. */
function tone(context: AudioContext, destination: AudioNode, options: ToneOptions): void {
  const {
    frequency,
    start = 0,
    duration = 0.15,
    type = 'sine',
    gain = 0.05,
    endFrequency,
    attack = 0.008,
    detune = 0,
  } = options;
  const t0 = context.currentTime + start;
  const oscillator = context.createOscillator();
  const envelope = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, t0);
  if (endFrequency !== undefined) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), t0 + duration);
  if (detune !== 0) oscillator.detune.setValueAtTime(detune, t0);
  envelope.gain.setValueAtTime(0.0001, t0);
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + attack);
  envelope.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  oscillator.connect(envelope);
  envelope.connect(destination);
  oscillator.start(t0);
  oscillator.stop(t0 + duration + 0.05);
}

type NoiseSweepOptions = {
  start?: number;
  duration?: number;
  gain?: number;
  from?: number;
  to?: number;
  q?: number;
};

/** Filtered white-noise burst with a frequency sweep — the "swoosh" layer. */
function noiseSweep(context: AudioContext, destination: AudioNode, options: NoiseSweepOptions): void {
  const { start = 0, duration = 0.18, gain = 0.05, from = 600, to = 2600, q = 1 } = options;
  const t0 = context.currentTime + start;
  const source = context.createBufferSource();
  source.buffer = getNoiseBuffer(context);
  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, t0);
  filter.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + duration);
  const envelope = context.createGain();
  envelope.gain.setValueAtTime(0.0001, t0);
  envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + duration * 0.35);
  envelope.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  source.connect(filter);
  filter.connect(envelope);
  envelope.connect(destination);
  source.start(t0);
  source.stop(t0 + duration + 0.05);
}

/** Bell-like retro chime: a sine plus faintly detuned upper partials. */
function chime(context: AudioContext, destination: AudioNode, frequency: number, start: number, duration: number, gain: number): void {
  const partials = [
    { ratio: 1, level: 1 },
    { ratio: 2.01, level: 0.3 },
    { ratio: 3.01, level: 0.11 },
  ];
  for (const partial of partials) {
    tone(context, destination, {
      frequency: frequency * partial.ratio,
      start,
      duration: duration / (partial.ratio * 0.6 + 0.4),
      type: 'sine',
      gain: gain * partial.level,
      attack: 0.012,
    });
  }
}

/**
 * Play one of the app's synthesized sound effects.
 * Respects the enabled toggle and master volume.
 */
export function playSound(name: SoundName): void {
  if (!settings.enabled) return;
  const engine = getEngine();
  if (!engine) return;
  const { context, master } = engine;

  switch (name) {
    case 'click':
      tone(context, master, { frequency: 1650, duration: 0.045, type: 'triangle', gain: 0.05 });
      tone(context, master, { frequency: 2350, duration: 0.028, type: 'sine', gain: 0.018 });
      break;
    case 'tap':
      tone(context, master, { frequency: 430, duration: 0.07, type: 'sine', gain: 0.04 });
      break;
    case 'flip':
      noiseSweep(context, master, { from: 700, to: 3100, duration: 0.15, gain: 0.055, q: 0.9 });
      tone(context, master, { frequency: 520, endFrequency: 260, duration: 0.1, type: 'sine', gain: 0.016 });
      break;
    case 'tick':
      tone(context, master, { frequency: 680, duration: 0.055, type: 'square', gain: 0.02 });
      break;
    case 'correct':
      tone(context, master, { frequency: 659.25, duration: 0.09, type: 'triangle', gain: 0.05 });
      tone(context, master, { frequency: 880, start: 0.085, duration: 0.13, type: 'triangle', gain: 0.055 });
      tone(context, master, { frequency: 1108.73, start: 0.11, duration: 0.09, type: 'sine', gain: 0.02 });
      break;
    case 'error':
      tone(context, master, { frequency: 200, endFrequency: 132, duration: 0.26, type: 'sawtooth', gain: 0.045 });
      tone(context, master, { frequency: 205, endFrequency: 136, duration: 0.26, type: 'sawtooth', gain: 0.028, detune: 12 });
      break;
    case 'transition':
      tone(context, master, { frequency: 340, endFrequency: 540, duration: 0.21, type: 'sine', gain: 0.04 });
      tone(context, master, { frequency: 680, endFrequency: 1080, start: 0.03, duration: 0.18, type: 'sine', gain: 0.015 });
      break;
    case 'win':
      [392, 493.88, 587.33, 783.99].forEach((frequency, index) => {
        tone(context, master, { frequency, start: index * 0.055, duration: 0.3, type: 'triangle', gain: 0.045 });
      });
      break;
    case 'levelup':
      [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
        tone(context, master, { frequency, start: index * 0.07, duration: 0.13, type: 'square', gain: 0.032 });
      });
      tone(context, master, { frequency: 1567.98, start: 0.28, duration: 0.22, type: 'sine', gain: 0.016 });
      break;
    case 'fanfare':
    case 'complete':
      tone(context, master, { frequency: 196, duration: 0.5, type: 'sawtooth', gain: 0.03 });
      tone(context, master, { frequency: 392, duration: 0.17, type: 'square', gain: 0.04 });
      tone(context, master, { frequency: 523.25, start: 0.16, duration: 0.17, type: 'square', gain: 0.04 });
      tone(context, master, { frequency: 659.25, start: 0.32, duration: 0.17, type: 'square', gain: 0.04 });
      tone(context, master, { frequency: 783.99, start: 0.48, duration: 0.62, type: 'square', gain: 0.05 });
      tone(context, master, { frequency: 783.99, start: 0.48, duration: 0.62, type: 'triangle', gain: 0.045 });
      tone(context, master, { frequency: 1046.5, start: 0.48, duration: 0.5, type: 'sine', gain: 0.03 });
      noiseSweep(context, master, { start: 0.48, from: 3200, to: 6800, duration: 0.22, gain: 0.02, q: 0.7 });
      break;
  }
}

/**
 * Retro cinematic splash chime — four synthesized chords (C — F — G — C)
 * with bell partials and a soft sub thump, like an old console booting up.
 * Returns false when audio could not start (e.g. blocked before a user gesture).
 */
export function playSplashChime(): boolean {
  if (!settings.enabled) return false;
  const engine = getEngine();
  if (!engine) return false;
  const { context, master } = engine;
  const chords: { at: number; notes: number[]; duration: number; gain: number }[] = [
    { at: 0, notes: [261.63, 329.63, 392.0], duration: 1.0, gain: 0.034 }, // C major
    { at: 0.38, notes: [349.23, 440.0, 523.25], duration: 1.0, gain: 0.034 }, // F major
    { at: 0.76, notes: [392.0, 493.88, 587.33], duration: 1.0, gain: 0.034 }, // G major
    { at: 1.14, notes: [523.25, 659.25, 783.99, 1046.5], duration: 1.7, gain: 0.04 }, // C major (resolve)
  ];
  for (const chord of chords) {
    for (const note of chord.notes) chime(context, master, note, chord.at, chord.duration, chord.gain);
  }
  tone(context, master, { frequency: 130.81, start: 1.14, duration: 0.9, type: 'sine', gain: 0.045 }); // C3 sub
  return true;
}

/** Warm up / resume the AudioContext from a user gesture (autoplay policies). */
export function unlockAudio(): void {
  getEngine();
}

export function getSoundSettings(): SoundSettings {
  return { ...settings };
}

export function setSoundEnabled(enabled: boolean): void {
  settings = { ...settings, enabled };
  persistSettings();
  applyMasterVolume();
  emitSettings();
}

export function setSoundVolume(volume: number): void {
  settings = { ...settings, volume: Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 0)) };
  persistSettings();
  applyMasterVolume();
  emitSettings();
}

export function subscribeToSoundSettings(listener: (next: SoundSettings) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
