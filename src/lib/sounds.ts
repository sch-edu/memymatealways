type SoundName = 'tap' | 'tick' | 'error' | 'transition' | 'win' | 'complete';

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext ??= new AudioContextClass();
  if (audioContext.state === 'suspended') void audioContext.resume();
  return audioContext;
}

export function playSound(name: SoundName): void {
  const context = getAudioContext();
  if (!context) return;
  const now = context.currentTime;
  const presets: Record<SoundName, { frequencies: number[]; duration: number; type: OscillatorType; gain: number }> = {
    tap: { frequencies: [420], duration: 0.07, type: 'sine', gain: 0.035 },
    tick: { frequencies: [680], duration: 0.055, type: 'square', gain: 0.018 },
    error: { frequencies: [210, 145], duration: 0.22, type: 'sawtooth', gain: 0.045 },
    transition: { frequencies: [360, 520], duration: 0.2, type: 'sine', gain: 0.04 },
    win: { frequencies: [440, 554, 659], duration: 0.32, type: 'sine', gain: 0.045 },
    complete: { frequencies: [392, 494, 587, 784], duration: 0.58, type: 'triangle', gain: 0.05 },
  };
  const preset = presets[name];
  preset.frequencies.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = now + index * Math.min(0.08, preset.duration / 3);
    oscillator.type = preset.type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(preset.gain, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + preset.duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + preset.duration + 0.02);
  });
}